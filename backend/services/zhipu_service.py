import os
import asyncio
import re


def _strip_fences(text: str) -> str:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        return m.group(1).strip()
    return text.strip()
from copy import deepcopy
from typing import Dict, List
from dotenv import load_dotenv

load_dotenv()

# ── Pre-computed demo analysis for the hackathon scenario ──────────────────
DEMO_ANALYSIS: Dict[str, Dict] = {
    "wiki-pollen": {
        "semantic_type": "theory",
        "topics": ["pollen", "allergy", "hay fever", "allergic rhinitis", "immune system", "birch", "paris"],
        "relevance_score": 0.92,
        "description": "Scientific foundation: pollen allergy mechanisms",
    },
    "yt-pollen": {
        "semantic_type": "explanation",
        "topics": ["pollen", "immune response", "IgE antibodies", "mast cells", "allergy", "histamine"],
        "relevance_score": 0.88,
        "description": "Visual explanation of pollen allergic response",
    },
    "map-paris-parks": {
        "semantic_type": "spatial",
        "topics": ["paris", "parks", "trees", "green spaces", "bois de boulogne", "pollen zones", "outdoor"],
        "relevance_score": 0.79,
        "description": "Geospatial: pollen emission hotspots in Paris",
    },
    "news-sports": {
        "semantic_type": "noise",
        "topics": ["football", "PSG", "Marseille", "sport", "Ligue 1", "soccer"],
        "relevance_score": 0.04,
        "description": "Sports news — unrelated to research goal",
    },
    "article-antihistamine": {
        "semantic_type": "theory",
        "topics": ["antihistamine", "H1 receptor", "allergy treatment", "medication", "histamine", "allergic"],
        "relevance_score": 0.86,
        "description": "Treatment mechanisms for allergic rhinitis",
    },
    "paris-air-quality": {
        "semantic_type": "spatial",
        "topics": ["paris", "air quality", "pollen count", "PM2.5", "allergen", "environment", "monitoring"],
        "relevance_score": 0.83,
        "description": "Real-time environmental allergen data for Paris",
    },
}

# ── Keyword sets for fallback scoring ─────────────────────────────────────
_HIGH_KEYWORDS = {
    "allergy", "pollen", "allergen", "hay fever", "rhinitis",
    "antihistamine", "immune", "histamine", "allergic", "atopy",
    "hypersensitivity", "sensitization", "exposure",
}
_MEDIUM_KEYWORDS = {
    "paris", "france", "tree", "park", "plant", "spring", "air",
    "quality", "environment", "outdoor", "birch", "grass", "flower",
    "garden", "nature",
}


class ZhipuService:
    def __init__(self):
        self.api_key = os.getenv("ZHIPU_API_KEY", "").strip()
        self.use_mock = not bool(self.api_key)

        if not self.use_mock:
            try:
                from zhipuai import ZhipuAI  # type: ignore
                self.client = ZhipuAI(api_key=self.api_key)
            except ImportError:
                self.use_mock = True

        mode = "MOCK" if self.use_mock else "ZHIPU AI"
        print(f"[ZhipuService] Running in {mode} mode")

    async def analyze_page(
        self,
        title: str,
        content: str,
        page_type: str,
        goal: str,
        page_id: str = "",
        image_url: str = "",
    ) -> Dict:
        if self.use_mock:
            return self._mock_analyze(title, content, page_type, page_id, goal)
        return await self._real_analyze(title, content, page_type, goal, image_url)

    # ── Mock ──────────────────────────────────────────────────────────────
    def _mock_analyze(self, title: str, content: str, page_type: str, page_id: str, goal: str = "") -> Dict:
        if page_id in DEMO_ANALYSIS:
            return self._goal_aware_demo_analysis(title, content, page_type, page_id, goal)

        text = f"{title} {content}".lower()

        high = sum(1 for k in _HIGH_KEYWORDS if k in text)
        medium = sum(1 for k in _MEDIUM_KEYWORDS if k in text)
        relevance = min(high * 0.20 + medium * 0.08, 1.0)

        if page_type == "video":
            semantic_type = "explanation"
        elif page_type == "map":
            semantic_type = "spatial"
        elif high >= 2:
            semantic_type = "theory"
        elif medium >= 2:
            semantic_type = "expansion"
        else:
            semantic_type = "noise"

        topics: List[str] = [k for k in _HIGH_KEYWORDS if k in text]
        topics += [k for k in _MEDIUM_KEYWORDS if k in text and k not in topics]
        if not topics:
            topics = [w for w in content.lower().split() if len(w) > 4][:4]

        return {
            "semantic_type": semantic_type,
            "topics": topics[:6],
            "relevance_score": round(relevance, 2),
            "description": f"{title[:60]}",
        }

    # ── Real Zhipu AI (glm-5v-turbo multimodal) ───────────────────────────
    async def _real_analyze(
        self,
        title: str,
        content: str,
        page_type: str,
        goal: str,
        image_url: str = "",
    ) -> Dict:
        import json

        text_prompt = f"""You are a cognitive analysis engine. Analyze this page in the context of the user's research goal.

Research Goal: {goal}
Page Type: {page_type}
Page Title: {title}
Content Preview: {content[:600]}

Return ONLY a JSON object (no markdown, no explanation):
{{
  "semantic_type": "<theory|explanation|spatial|noise>",
  "topics": ["topic1", "topic2", "topic3"],
  "relevance_score": <float 0.0-1.0>,
  "description": "<one sentence under 80 chars>"
}}"""

        # glm-5v-turbo uses the multimodal content array format.
        # Include an image when one is provided (e.g. a screenshot or thumbnail).
        if image_url:
            model = "glm-4-flash"
            user_content = [
                {"type": "image_url", "image_url": {"url": image_url}},
                {"type": "text", "text": text_prompt},
            ]
        else:
            model = "glm-4-flash"
            user_content = text_prompt

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": user_content}],
                    temperature=0.1,
                    max_tokens=1024,
                ),
            )
            raw = response.choices[0].message.content.strip()
            return json.loads(_strip_fences(raw))
        except Exception as exc:
            print(f"[ZhipuService] API error: {exc} — falling back to mock")
            return self._mock_analyze(title, content, page_type, "", goal)

    def _goal_aware_demo_analysis(
        self,
        title: str,
        content: str,
        page_type: str,
        page_id: str,
        goal: str,
    ) -> Dict:
        analysis = deepcopy(DEMO_ANALYSIS[page_id])
        goal_terms = self._extract_goal_terms(goal)
        page_text = f"{title} {content} {' '.join(analysis.get('topics', []))}".lower()
        matched_terms = [term for term in goal_terms if term in page_text]

        if not goal_terms:
            return analysis

        match_ratio = len(matched_terms) / max(len(goal_terms), 1)
        weak_location_only = bool(matched_terms) and all(
            term in {"paris", "france", "ile-de-france", "île-de-france"}
            for term in matched_terms
        )

        if weak_location_only:
            analysis["relevance_score"] = 0.12
            analysis["semantic_type"] = "noise"
            analysis["description"] = "Only shares a location with the goal, not the research topic"
        elif match_ratio >= 0.45 or len(matched_terms) >= 2:
            analysis["relevance_score"] = 0.88
            if page_id == "news-sports":
                analysis["semantic_type"] = "theory"
                analysis["description"] = "Football match report related to the current goal"
            else:
                analysis["description"] = f"Directly related to the current goal: {', '.join(matched_terms[:3])}"
        elif matched_terms:
            analysis["relevance_score"] = 0.52
            if analysis["semantic_type"] == "noise":
                analysis["semantic_type"] = "expansion"
            analysis["description"] = f"Adjacent to the current goal via {matched_terms[0]}"
        else:
            analysis["relevance_score"] = 0.08
            analysis["semantic_type"] = "noise"
            analysis["description"] = "Not directly related to the current research goal"

        return analysis

    def _extract_goal_terms(self, goal: str) -> List[str]:
        raw_terms = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", goal.lower())
        stop_words = {"the", "and", "for", "with", "about", "into", "from", "research", "study", "related"}
        terms = [term for term in raw_terms if term not in stop_words]

        expansions = {
            "football": ["football", "soccer", "psg", "marseille", "ligue"],
            "soccer": ["football", "soccer", "psg", "marseille", "ligue"],
            "psg": ["psg", "paris saint-germain", "football", "ligue"],
            "marseille": ["marseille", "olympique", "football", "ligue"],
            "allergy": ["allergy", "allergic", "allergen", "pollen", "rhinitis", "histamine"],
            "pollen": ["pollen", "allergy", "allergen", "birch", "grass"],
        }

        expanded: List[str] = []
        for term in terms:
            expanded.extend(expansions.get(term, [term]))

        return list(dict.fromkeys(expanded))
