from services.models import AlignmentCategory


TOPIC_EXPANSIONS = {
    "football": ["match tactics", "player performance", "league table"],
    "soccer": ["match tactics", "player performance", "league table"],
    "psg": ["Paris Saint-Germain squad", "Ligue 1 title race", "PSG match analysis"],
    "marseille": ["Olympique Marseille form", "Ligue 1 rivalry", "derby analysis"],
    "match": ["tactical analysis", "lineup comparison", "post-match stats"],
    "tactics": ["pressing structure", "set pieces", "transition play"],
    "allergy": ["allergen exposure", "immunotherapy", "symptom treatment"],
    "pollen": ["pollen calendar", "pollen forecast", "birch season"],
}


class ReflectionAgent:
    DRIFT_PROMPT = "Your research thread is drifting from the current goal."

    def reflect(self, category: AlignmentCategory, title: str, drift_seconds: int, topics: list[str] | None = None) -> dict:
        topics = topics or []

        if category == "aligned":
            suggestion = self._next_step_suggestion(topics)
            return {
                "soft_message": f"Your research thread is still connected to {title[:48]}.",
                "suggestion": suggestion,
                "should_prompt": drift_seconds >= 20,
                "prompt_kind": "encouragement",
            }

        if category == "expansion":
            return {
                "soft_message": f"This tab may be a useful branch from your research thread.",
                "suggestion": self._next_step_suggestion(topics),
                "should_prompt": False,
                "prompt_kind": "none",
            }

        return {
            "soft_message": self.DRIFT_PROMPT,
            "suggestion": "If this page is intentional, you can stay here. I will step back.",
            "should_prompt": drift_seconds >= 30,
            "prompt_kind": "drift",
        }

    def _next_step_suggestion(self, topics: list[str]) -> str:
        next_topics: list[str] = []
        for topic in topics:
            for candidate in TOPIC_EXPANSIONS.get(topic.lower(), []):
                if candidate not in next_topics:
                    next_topics.append(candidate)
                if len(next_topics) >= 3:
                    break
            if len(next_topics) >= 3:
                break

        if next_topics:
            return f"Nice thread. If useful, try exploring next: {', '.join(next_topics)}."

        return "Nice thread. Keep going if this page is helping the task."
