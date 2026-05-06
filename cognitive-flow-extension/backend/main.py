from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.analyzer import TabAnalyzer
from services.cognitive_state import CognitiveState
from services.models import AnalyzeResponse, FeedbackRequest, Reflection, SessionStartRequest, TabAnalyzeRequest, TabNode
from services.reflection_agent import ReflectionAgent

app = FastAPI(title="Threadmate Agent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"chrome-extension://.*",
    allow_methods=["*"],
    allow_headers=["*"],
)

state = CognitiveState()
analyzer = TabAnalyzer()
reflector = ReflectionAgent()


@app.get("/")
async def root():
    return {"status": "Threadmate Agent API running"}


@app.post("/session/start")
async def start_session(payload: SessionStartRequest):
    state.start(payload.goal)
    return state.summary()


@app.post("/session/end")
async def end_session():
    summary = state.summary()
    state.start("")
    return summary


@app.get("/state")
async def get_state():
    return state.summary()


@app.post("/analyze-tab", response_model=AnalyzeResponse)
async def analyze_tab(payload: TabAnalyzeRequest):
    if not state.goal:
        state.start("Untitled Research Goal")

    analysis = analyzer.analyze(
        goal=state.goal,
        title=payload.title,
        url=payload.url,
        text=payload.text,
        learned_terms=state.learned_terms,
    )
    node = TabNode(
        id=f"tab-{payload.tab_id}",
        tab_id=payload.tab_id,
        url=payload.url,
        title=payload.title or payload.url,
        topics=analysis["topics"],
        relevance_score=analysis["relevance_score"],
        alignment_category=analysis["alignment_category"],
        active_duration=payload.active_duration,
        visit_index=payload.visit_index,
        description=analysis["description"],
    )
    state.add_or_update(node)

    reflection = Reflection(
        **reflector.reflect(
            category=node.alignment_category,
            title=node.title,
            drift_seconds=int(payload.active_duration),
            topics=node.topics,
        )
    )

    return AnalyzeResponse(
        goal=state.goal,
        node=node,
        reflection=reflection,
        drift_seconds=int(payload.active_duration),
    )


@app.post("/feedback/relevant")
async def mark_tab_relevant(payload: FeedbackRequest):
    if payload.label != "relevant":
        return {"ok": False, "reason": "unsupported feedback label"}

    result = state.mark_relevant(payload.tab_id, payload.reason)
    if not result:
        return {"ok": False, "reason": "tab not found"}

    node = result["node"]

    return {
        "ok": True,
        "verified": result["verified"],
        "passed_checks": result["passed_checks"],
        "checks": result["checks"],
        "node": node.model_dump(),
        "learned_terms": state.learned_terms,
        "message": "Okay, I will redefine pages like this as part of your goal.",
    }
