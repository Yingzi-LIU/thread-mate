import re
from typing import Dict, List

from services.models import TabNode


class CognitiveState:
    def __init__(self):
        self.goal = ""
        self.nodes: Dict[str, TabNode] = {}
        self.category_counts = {"aligned": 0, "expansion": 0, "drift": 0}
        self.learned_terms: List[str] = []

    def start(self, goal: str):
        self.goal = self.normalize_goal(goal)
        self.nodes = {}
        self.category_counts = {"aligned": 0, "expansion": 0, "drift": 0}
        self.learned_terms = []

    def add_or_update(self, node: TabNode):
        old = self.nodes.get(node.id)
        if old:
            self.category_counts[old.alignment_category] -= 1

        self.nodes[node.id] = node
        self.category_counts[node.alignment_category] += 1

    def mark_relevant(self, tab_id: int, reason: str = "") -> dict | None:
        node = self.nodes.get(f"tab-{tab_id}")
        if not node:
            return None

        checks = self._verify_relevance_feedback(node)
        passed = sum(1 for value in checks.values() if value)
        verified = passed >= 2

        if node.alignment_category != "aligned":
            self.category_counts[node.alignment_category] -= 1
            self.category_counts["aligned"] += 1

        node.alignment_category = "aligned"
        node.relevance_score = max(node.relevance_score, 0.82)
        node.description = "Marked relevant by the user."
        self.learn_from_topics(node.topics)

        return {
            "node": node,
            "verified": verified,
            "passed_checks": passed,
            "checks": checks,
        }

    def learn_from_topics(self, topics: List[str]):
        for topic in topics:
            clean = topic.lower().strip()
            if len(clean) >= 3 and clean not in self.learned_terms:
                self.learned_terms.append(clean)
            if len(self.learned_terms) >= 24:
                break

    def summary(self):
        return {
            "goal": self.goal,
            "nodes": [n.model_dump() for n in sorted(self.nodes.values(), key=lambda n: n.visit_index)],
            "category_counts": self.category_counts,
            "learned_terms": self.learned_terms,
        }

    @staticmethod
    def normalize_goal(goal: str) -> str:
        clean = " ".join(goal.strip().split()) or "Untitled Research Goal"
        small_words = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "with"}
        words = clean.split(" ")
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

    @staticmethod
    def goal_terms(goal: str) -> List[str]:
        words = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", goal.lower())
        stop_words = {"the", "and", "for", "with", "about", "into", "from", "research", "study", "task", "goal"}
        return [w for w in words if w not in stop_words]

    def _verify_relevance_feedback(self, node: TabNode) -> Dict[str, bool]:
        page_terms = set(self._terms(" ".join([node.title, node.url, " ".join(node.topics)])))
        goal_terms = set(self.goal_terms(self.goal))
        learned_terms = set(self.learned_terms)

        model_signal = node.relevance_score >= 0.25
        page_evidence = len(page_terms - {"example", "about", "notebook"}) >= 3
        goal_bridge = bool(page_terms & (goal_terms | learned_terms)) or node.relevance_score >= 0.25

        return {
            "model_signal": model_signal,
            "page_evidence": page_evidence,
            "goal_bridge": goal_bridge,
        }

    @staticmethod
    def _terms(text: str) -> List[str]:
        words = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", text.lower())
        stop_words = {"the", "and", "for", "with", "about", "into", "from", "this", "that", "page", "goal", "helps"}
        return [word for word in words if word not in stop_words]
