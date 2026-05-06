from typing import List, Literal

from pydantic import BaseModel


AlignmentCategory = Literal["aligned", "expansion", "drift"]


class SessionStartRequest(BaseModel):
    goal: str


class TabAnalyzeRequest(BaseModel):
    tab_id: int
    url: str
    title: str
    text: str = ""
    active_duration: float = 0
    visit_index: int = 0


class FeedbackRequest(BaseModel):
    tab_id: int
    label: Literal["relevant", "not_relevant"]
    reason: str = ""


class TabNode(BaseModel):
    id: str
    tab_id: int
    url: str
    title: str
    topics: List[str]
    relevance_score: float
    alignment_category: AlignmentCategory
    active_duration: float
    visit_index: int
    description: str


class Reflection(BaseModel):
    soft_message: str
    suggestion: str
    should_prompt: bool
    prompt_kind: Literal["drift", "encouragement", "none"] = "none"


class AnalyzeResponse(BaseModel):
    goal: str
    node: TabNode
    reflection: Reflection
    drift_seconds: int
