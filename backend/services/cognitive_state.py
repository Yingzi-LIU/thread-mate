import re
import time
from typing import List, Dict, Set


class CognitiveStateManager:
    DEFAULT_GOAL = "Allergy research in Paris"

    def __init__(self, goal: str | None = None):
        self.goal = self._normalize_goal(goal or self.DEFAULT_GOAL)
        self.nodes: List[Dict] = []
        self.drift_score: float = 0.0
        self.session_alignment: float = 0.0   # cumulative avg alignment of all visited pages
        self.category_counts: Dict[str, int] = {"aligned": 0, "expansion": 0, "drift": 0}
        self._visited_ids: Set[str] = set()

        # Seed the goal node
        self.nodes.append({
            "id": "goal",
            "title": self.goal,
            "semantic_type": "goal",
            "alignment_category": "aligned",
            "topics": self._goal_topics(self.goal),
            "relevance_score": 1.0,
            "description": "Primary cognitive research objective",
            "x": 80,
            "y": 280,
            "timestamp": time.time(),
        })
        self._visited_ids.add("goal")

    def add_node(self, node: Dict) -> bool:
        if node["id"] in self._visited_ids:
            return False
        node["timestamp"] = time.time()
        self.nodes.append(node)
        self._visited_ids.add(node["id"])
        self._recompute_session_stats()
        return True

    def _recompute_session_stats(self):
        non_goal = [n for n in self.nodes if n["id"] != "goal"]
        if not non_goal:
            self.drift_score = 0.0
            self.session_alignment = 0.0
            self.category_counts = {"aligned": 0, "expansion": 0, "drift": 0}
            return

        scores = [n["relevance_score"] for n in non_goal]
        avg_relevance = sum(scores) / len(scores)

        self.drift_score = round(1.0 - avg_relevance, 3)
        self.session_alignment = round(avg_relevance, 3)

        self.category_counts = {"aligned": 0, "expansion": 0, "drift": 0}
        for n in non_goal:
            cat = n.get("alignment_category", "aligned")
            if cat in self.category_counts:
                self.category_counts[cat] += 1

    def get_current_topics(self) -> List[str]:
        topics: Set[str] = set()
        for node in self.nodes:
            topics.update(node.get("topics", []))
        return list(topics)

    def _goal_topics(self, goal: str) -> List[str]:
        words = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", goal.lower())
        stop_words = {"the", "and", "for", "with", "about", "into", "from", "research", "study"}
        topics = [w for w in words if w not in stop_words]
        return topics[:6] or ["research"]

    def _normalize_goal(self, goal: str) -> str:
        clean_goal = " ".join(goal.strip().split()) or self.DEFAULT_GOAL
        small_words = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "with"}
        words = clean_goal.split(" ")
        normalized: List[str] = []

        for index, word in enumerate(words):
            if word.isupper() and len(word) <= 4:
                normalized.append(word)
                continue

            lower = word.lower()
            if 0 < index < len(words) - 1 and lower in small_words:
                normalized.append(lower)
            else:
                normalized.append(word[:1].upper() + word[1:].lower())

        return " ".join(normalized)

    def get_state(self) -> Dict:
        return {
            "goal": self.goal,
            "nodes": self.nodes,
            "drift_score": self.drift_score,
            "session_alignment": self.session_alignment,
            "category_counts": self.category_counts,
            "node_count": len(self.nodes),
        }

    def reset(self, goal: str | None = None):
        self.__init__(goal or self.goal)

    def set_goal(self, goal: str):
        clean_goal = self._normalize_goal(goal)
        self.reset(clean_goal)
