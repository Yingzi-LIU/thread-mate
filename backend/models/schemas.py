from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class PageVisit(BaseModel):
    id: str
    title: str
    type: str  # web | video | map | news
    content_preview: str
    url: str
    image_url: Optional[str] = ""  # optional screenshot/thumbnail for glm-5v-turbo


class CognitiveNode(BaseModel):
    id: str
    title: str
    semantic_type: str  # goal | theory | explanation | spatial | drift | expansion | noise
    alignment_category: str  # aligned | expansion | drift
    topics: List[str]
    relevance_score: float
    description: str
    x: float
    y: float


class CognitiveEdge(BaseModel):
    id: str
    source: str
    target: str
    strength: float
    animated: bool = True


class GraphState(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class ReflectionState(BaseModel):
    goal: str
    alignment_category: str
    alignment_score: float
    soft_message: str
    detail: str
    suggestion: str
    node_count: int
    cognitive_summary: str


class WSMessage(BaseModel):
    type: str
    page: Optional[PageVisit] = None
