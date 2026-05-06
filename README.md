# Threadmate

## Team Name and Team Member Information

[To be added manually later]

## Project Description

A multi-modal AI agent that models user cognitive intent across web pages, YouTube, and documents — and reflects attention structure in real time through a live knowledge graph.

## Problem Being Solved and Why It Matters

This project addresses the challenge of maintaining focus during information foraging tasks, such as research, learning, or content consumption across multiple media types. By modeling cognitive intent and detecting attention drift in real-time, it helps users stay aligned with their primary objectives, preventing distractions from unrelated content. This is particularly valuable in an era of information overload, where users often get sidetracked while browsing, leading to inefficient workflows and reduced productivity.

## Source Repository Link

[To be added manually later]

## Demo Video

Recommended length 3–5 minutes. [To be added manually later]

## Technologies Used

- **Frontend**: Next.js 14, React Flow, Tailwind CSS
- **Backend**: FastAPI, WebSocket, Pydantic
- **AI**: Zhipu AI `glm-4` (or built-in mock)
- **Graph**: Real-time WebSocket updates → React Flow

---

## Demo Scenario: Allergy Research in Paris

Click through the 6 simulated pages in order to see the full demo:

| Step | Page | Type | Expected Result |
|------|------|------|----------------|
| 1 | Pollen Allergy — Wikipedia | Theory | ✅ Aligned |
| 2 | Understanding Pollen — YouTube | Explanation | ✅ Aligned |
| 3 | Paris Parks Map | Spatial | ✅ Aligned |
| 4 | PSG vs Marseille Match Report | News | 🔴 Drift detected |
| 5 | Antihistamines Article | Theory | ✅ Aligned |
| 6 | Paris Air Quality Index | Data | ✅ Aligned |

---

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Opens `http://localhost:3000` automatically.

### Manual start

**Backend (FastAPI)**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend (Next.js)**
```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                                    │
│  ┌──────────────┬──────────────────┬─────────────────────┐  │
│  │ Page         │  Cognitive       │  Reflection         │  │
│  │ Simulator    │  Graph           │  Panel              │  │
│  │ (left panel) │  (React Flow)    │  (right panel)      │  │
│  └──────┬───────┴──────────────────┴──────────┬──────────┘  │
│         │  WebSocket (ws://localhost:8000/ws)  │             │
└─────────┼──────────────────────────────────────┼────────────┘
          │                                      │
┌─────────▼──────────────────────────────────────▼────────────┐
│  FastAPI Backend (localhost:8000)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  CognitiveStateManager  →  GraphBuilder               │   │
│  │  ZhipuService (AI/mock) →  DriftDetector              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## AI Integration (Zhipu AI)

By default the system runs in **mock mode** (no API key needed for the demo).

To enable real Zhipu AI analysis:

```bash
# backend/.env
ZHIPU_API_KEY=your_key_here
```

Get a key at [open.bigmodel.cn](https://open.bigmodel.cn/).

The `ZhipuService` will automatically switch to live mode and send each page through `glm-4` for:
- Semantic type classification
- Topic extraction
- Relevance scoring

---

## Node Types

| Type | Color | Meaning |
|------|-------|---------|
| 🧠 GOAL | Indigo | Primary research objective |
| 📚 THEORY | Purple | Scientific / conceptual content |
| 🎬 EXPLAIN | Cyan | Video / explanatory content |
| 🗺️ SPATIAL | Emerald | Maps / geographic data |
| 🌿 EXPAND | Amber | Adjacent / expansion content |
| 🌊 DRIFT | Rose | Unrelated content |

## Alignment Thresholds

| Score | Category | Meaning |
|-------|----------|---------|
| ≥ 0.65 | Aligned | Core research thread |
| 0.35 – 0.65 | Expansion | Adjacent exploration |
| < 0.35 | Drift | Unrelated content |

---

*"This is not a productivity tracker — it is a cognitive mirror."*
