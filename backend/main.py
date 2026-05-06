import asyncio
import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.cognitive_state import CognitiveStateManager
from services.drift_detection import DriftDetector
from services.graph_builder import GraphBuilder
from services.zhipu_service import ZhipuService
from services.reflection_agent import ReflectionAgent

app = FastAPI(title="Threadmate API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons (single-user demo) ─────────────────────────────────────────
state = CognitiveStateManager()
zhipu = ZhipuService()
builder = GraphBuilder()
detector = DriftDetector()
reflector = ReflectionAgent(zhipu)  # shares zhipu client + mock mode
latest_tab_import: dict = {
    "source": "",
    "goal": "",
    "imported_at": "",
    "tabs": [],
}
latest_extension_session: dict = {
    "source": "",
    "goal": "",
    "tone": "",
    "started_at": "",
}


class ImportedTab(BaseModel):
    id: str
    tab_id: Optional[int] = None
    window_id: Optional[int] = None
    index: Optional[int] = None
    title: str
    url: str
    type: str = "web"
    content_preview: str = ""
    active: bool = False


class TabImportPayload(BaseModel):
    source: str = "chrome-extension"
    goal: str = ""
    imported_at: Optional[str] = None
    tabs: List[ImportedTab]


class ExtensionSessionPayload(BaseModel):
    source: str = "chrome-extension"
    goal: str
    tone: str = "friend"
    started_at: Optional[str] = None


# ── WebSocket connection manager ──────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def send(self, ws: WebSocket, payload: dict):
        await ws.send_text(json.dumps(payload))

    async def broadcast(self, payload: dict):
        for ws in self.connections:
            await ws.send_text(json.dumps(payload))


manager = ConnectionManager()


# ── REST endpoints ─────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "Threadmate API running", "mode": "mock" if zhipu.use_mock else "zhipu"}


@app.get("/state")
async def get_state():
    s = state.get_state()
    edges = builder.compute_edges(s["nodes"])
    return {**s, "edges": edges}


@app.post("/reset")
async def reset():
    state.reset()
    builder.reset()
    return {"status": "reset"}


@app.post("/imports/tabs")
async def import_tabs(payload: TabImportPayload):
    global latest_tab_import

    latest_tab_import = {
        "source": payload.source,
        "goal": payload.goal,
        "imported_at": payload.imported_at or datetime.now(timezone.utc).isoformat(),
        "tabs": [tab.model_dump() for tab in payload.tabs],
    }
    return {
        "ok": True,
        "count": len(payload.tabs),
        "imported_at": latest_tab_import["imported_at"],
    }


@app.get("/imports/latest")
async def get_latest_tab_import():
    return latest_tab_import


@app.post("/imports/session")
async def import_extension_session(payload: ExtensionSessionPayload):
    global latest_extension_session

    latest_extension_session = {
        "source": payload.source,
        "goal": payload.goal,
        "tone": payload.tone,
        "started_at": payload.started_at or datetime.now(timezone.utc).isoformat(),
    }
    return {"ok": True, **latest_extension_session}


@app.get("/imports/session")
async def get_latest_extension_session():
    return latest_extension_session


# ── WebSocket endpoint ────────────────────────────────────────────────────
@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    # Send initial graph (goal node already seeded)
    current = state.get_state()
    edges = builder.compute_edges(current["nodes"])
    await manager.send(websocket, {
        "type": "init",
        "graph": {"nodes": current["nodes"], "edges": edges},
        "reflection": _initial_reflection(current["goal"]),
        "drift_score": 0.0,
        "session_alignment": 0.0,
        "category_counts": {"aligned": 0, "expansion": 0, "drift": 0},
    })

    async def keepalive():
        while True:
            await asyncio.sleep(20)
            try:
                await websocket.send_text(json.dumps({"type": "ping"}))
            except Exception:
                break

    ping_task = asyncio.create_task(keepalive())

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            if msg.get("type") == "pong":
                continue

            # ── page_visit ──────────────────────────────────────────────
            if msg["type"] == "page_visit":
                page = msg["page"]

                # 1. Understand the page with glm-5v-turbo (or mock)
                analysis = await zhipu.analyze_page(
                    title=page["title"],
                    content=page["content_preview"],
                    page_type=page["type"],
                    goal=state.goal,
                    page_id=page["id"],
                    image_url=page.get("image_url", ""),  # optional screenshot/thumbnail
                )

                # 2. Compute alignment
                alignment = detector.compute_alignment(
                    relevance_score=analysis["relevance_score"],
                    page_topics=analysis["topics"],
                    current_topics=state.get_current_topics(),
                )

                # 3. Build node
                node = builder.add_node(
                    page_id=page["id"],
                    title=page["title"],
                    semantic_type=analysis["semantic_type"],
                    alignment_category=alignment["category"],
                    topics=analysis["topics"],
                    relevance_score=analysis["relevance_score"],
                    description=analysis["description"],
                )

                # 4. Update state
                added = state.add_node(node)
                if not added:
                    # Already visited — just echo current state
                    current = state.get_state()
                    edges = builder.compute_edges(current["nodes"])
                    await manager.send(websocket, {
                        "type": "already_visited",
                        "graph": {"nodes": current["nodes"], "edges": edges},
                    })
                    continue

                # 5. Reflection Agent — LLM-generated contextual feedback
                current = state.get_state()
                edges = builder.compute_edges(current["nodes"])
                rf = await reflector.reflect(
                    goal=state.goal,
                    alignment=alignment,
                    analysis=analysis,
                    graph_nodes=current["nodes"],
                    category_counts=current["category_counts"],
                    covered_topics=state.get_current_topics(),
                )
                reflection = {
                    "goal":                   state.goal,
                    "alignment_category":     alignment["category"],
                    "alignment_score":        alignment["score"],
                    "soft_message":           rf["soft_message"],
                    "suggestion":             rf["suggestion"],
                    "cognitive_summary":      rf["cognitive_summary"],
                    "detail":                 analysis.get("description", ""),
                    "node_count":             len(current["nodes"]),
                    "current_topics":         analysis.get("topics", [])[:4],
                    "current_semantic_type":  analysis.get("semantic_type", ""),
                }
                notification = {
                    "message": rf["soft_message"],
                    "category": alignment["category"],
                }

                await manager.send(websocket, {
                    "type": "update",
                    "graph": {"nodes": current["nodes"], "edges": edges},
                    "reflection": reflection,
                    "notification": notification,
                    "drift_score": current["drift_score"],
                    "session_alignment": current["session_alignment"],
                    "category_counts": current["category_counts"],
                })

            # ── batch_visit ─────────────────────────────────────────────
            elif msg["type"] == "batch_visit":
                pages = msg.get("pages", [])
                if not pages:
                    continue

                # Analyse all pages concurrently
                analyses = await asyncio.gather(*[
                    zhipu.analyze_page(
                        title=p["title"],
                        content=p["content_preview"],
                        page_type=p["type"],
                        goal=state.goal,
                        page_id=p["id"],
                        image_url=p.get("image_url", ""),
                    )
                    for p in pages
                ])

                # Add nodes to state sequentially (preserves order / shared state)
                last_alignment = None
                last_analysis = None
                for page, analysis in zip(pages, analyses):
                    alignment = detector.compute_alignment(
                        relevance_score=analysis["relevance_score"],
                        page_topics=analysis["topics"],
                        current_topics=state.get_current_topics(),
                    )
                    node = builder.add_node(
                        page_id=page["id"],
                        title=page["title"],
                        semantic_type=analysis["semantic_type"],
                        alignment_category=alignment["category"],
                        topics=analysis["topics"],
                        relevance_score=analysis["relevance_score"],
                        description=analysis["description"],
                    )
                    state.add_node(node)
                    last_alignment = alignment
                    last_analysis = analysis

                # Single reflection over the final state
                current = state.get_state()
                edges = builder.compute_edges(current["nodes"])
                rf = await reflector.reflect(
                    goal=state.goal,
                    alignment=last_alignment,
                    analysis=last_analysis,
                    graph_nodes=current["nodes"],
                    category_counts=current["category_counts"],
                    covered_topics=state.get_current_topics(),
                )
                await manager.send(websocket, {
                    "type": "batch_update",
                    "graph": {"nodes": current["nodes"], "edges": edges},
                    "reflection": {
                        "goal": state.goal,
                        "alignment_category": last_alignment["category"],
                        "alignment_score": last_alignment["score"],
                        "soft_message": rf["soft_message"],
                        "suggestion": rf["suggestion"],
                        "cognitive_summary": rf["cognitive_summary"],
                        "detail": last_analysis.get("description", ""),
                        "node_count": len(current["nodes"]),
                    },
                    "drift_score": current["drift_score"],
                    "session_alignment": current["session_alignment"],
                    "category_counts": current["category_counts"],
                })

            # ── reset ───────────────────────────────────────────────────
            elif msg["type"] == "reset":
                state.reset(msg.get("goal"))
                builder.reset()
                current = state.get_state()
                edges = builder.compute_edges(current["nodes"])
                await manager.send(websocket, {
                    "type": "reset",
                    "graph": {"nodes": current["nodes"], "edges": edges},
                    "reflection": _initial_reflection(current["goal"]),
                    "drift_score": 0.0,
                    "session_alignment": 0.0,
                    "category_counts": {"aligned": 0, "expansion": 0, "drift": 0},
                })

            # ── set_goal ────────────────────────────────────────────────
            elif msg["type"] == "set_goal":
                state.set_goal(msg.get("goal", ""))
                builder.reset()
                current = state.get_state()
                edges = builder.compute_edges(current["nodes"])
                await manager.send(websocket, {
                    "type": "goal_update",
                    "graph": {"nodes": current["nodes"], "edges": edges},
                    "reflection": _initial_reflection(current["goal"]),
                    "drift_score": 0.0,
                    "session_alignment": 0.0,
                    "category_counts": {"aligned": 0, "expansion": 0, "drift": 0},
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    finally:
        ping_task.cancel()


# ── Helpers ───────────────────────────────────────────────────────────────
def _initial_reflection(goal: str) -> dict:
    return {
        "goal": goal,
        "alignment_category": "aligned",
        "alignment_score": 1.0,
        "soft_message": "Begin your research journey...",
        "detail": f"Cognitive thread initialised for: {goal}",
        "suggestion": "Click a page in the browser panel to start exploring.",
        "node_count": 1,
        "cognitive_summary": "Cognitive goal thread established.",
    }
