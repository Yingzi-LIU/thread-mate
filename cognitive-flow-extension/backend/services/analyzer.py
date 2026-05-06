import re
from typing import Dict, List

from services.cognitive_state import CognitiveState


class TabAnalyzer:
    DOMAIN_EXPANSIONS: Dict[str, List[str]] = {
        "football": ["football", "soccer", "psg", "marseille", "ligue", "match", "club"],
        "soccer": ["football", "soccer", "psg", "marseille", "ligue", "match", "club"],
        "psg": ["psg", "paris saint-germain", "football", "ligue"],
        "marseille": ["marseille", "olympique", "football", "ligue"],
        "allergy": ["allergy", "allergic", "allergen", "pollen", "rhinitis", "histamine"],
        "pollen": ["pollen", "allergy", "allergen", "birch", "grass"],
    }

    def analyze(self, goal: str, title: str, url: str, text: str, learned_terms: List[str] | None = None) -> Dict:
        content = f"{title} {url} {text}".lower()
        goal_terms = self._expanded_goal_terms(goal)
        if learned_terms:
            goal_terms = list(dict.fromkeys([*goal_terms, *learned_terms]))
        matched = [term for term in goal_terms if term in content]
        topics = self._extract_topics(content, matched)

        if not goal_terms:
            relevance = 0.0
        else:
            relevance = min(1.0, len(matched) / max(3, len(goal_terms)) + len(set(matched)) * 0.12)

        weak_location_only = matched and all(term in {"paris", "france"} for term in matched)
        if weak_location_only:
            relevance = min(relevance, 0.18)

        if relevance >= 0.65:
            category = "aligned"
            description = "This tab supports the current research goal."
        elif relevance >= 0.35:
            category = "expansion"
            description = "This tab is adjacent to the current research goal."
        else:
            category = "drift"
            description = "This tab is drifting from the current research goal."

        return {
            "topics": topics,
            "relevance_score": round(relevance, 3),
            "alignment_category": category,
            "description": description,
        }

    def _expanded_goal_terms(self, goal: str) -> List[str]:
        terms = CognitiveState.goal_terms(goal)
        expanded: List[str] = []
        for term in terms:
            expanded.extend(self.DOMAIN_EXPANSIONS.get(term, [term]))
        return list(dict.fromkeys(expanded))

    def _extract_topics(self, content: str, matched: List[str]) -> List[str]:
        candidates = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{3,}", content)
        stop_words = {"https", "http", "www", "com", "html", "page", "this", "that", "with", "from", "have", "will"}
        topics = matched[:]
        for word in candidates:
            if word not in stop_words and word not in topics:
                topics.append(word)
            if len(topics) >= 8:
                break
        return topics[:8] or ["untitled"]
