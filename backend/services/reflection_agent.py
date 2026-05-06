import json
import asyncio
import random
import re
from typing import Dict, List


def _strip_fences(text: str) -> str:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        return m.group(1).strip()
    return text.strip()

# Topic expansion graph for mock mode.
# key = known topic, value = related topics worth exploring next.
_TOPIC_EXPANSION: Dict[str, List[str]] = {
    "pollen":           ["pollen calendar", "pollen count forecast", "birch pollen season", "grass pollen"],
    "allergy":          ["allergy testing", "immunotherapy", "skin prick test", "allergen immunotherapy"],
    "hay fever":        ["seasonal allergic rhinitis", "nasal corticosteroids", "antihistamine comparison"],
    "allergic rhinitis":["nasal polyps", "sinusitis", "anosmia", "decongestants"],
    "immune system":    ["IgE antibodies", "mast cell activation", "eosinophils", "basophils"],
    "antihistamine":    ["cetirizine", "loratadine", "fexofenadine", "H1 receptor blocker"],
    "histamine":        ["histamine intolerance", "DAO enzyme", "low-histamine diet"],
    "IgE antibodies":   ["RAST test", "ImmunoCAP", "total IgE levels", "specific IgE"],
    "mast cells":       ["mast cell degranulation", "tryptase", "mast cell stabilizers"],
    "paris":            ["Paris pollen monitoring", "Île-de-France air quality", "Paris botanical garden"],
    "air quality":      ["PM2.5 Paris", "AirParif", "Atmo France", "nitrogen dioxide"],
    "parks":            ["Bois de Boulogne", "Jardin des Plantes", "Parc de la Villette", "Luxembourg Gardens"],
}


class ReflectionAgent:
    """
    Generates contextual cognitive reflections using glm-5v-turbo.
    The 'suggestion' field proactively recommends specific next topics
    to explore based on the current research direction and what's already been covered.
    """

    def __init__(self, zhipu_service):
        self.zhipu = zhipu_service

    async def reflect(
        self,
        goal: str,
        alignment: Dict,
        analysis: Dict,
        graph_nodes: List[Dict],
        category_counts: Dict[str, int],
        covered_topics: List[str],
    ) -> Dict:
        node_count = len([n for n in graph_nodes if n["id"] != "goal"])

        if self.zhipu.use_mock:
            return self._mock_reflect(
                goal, alignment, analysis, node_count, category_counts, covered_topics
            )

        return await self._real_reflect(
            goal, alignment, analysis, graph_nodes, category_counts, node_count, covered_topics
        )

    # ── Mock path ─────────────────────────────────────────────────────────

    def _mock_reflect(
        self,
        goal: str,
        alignment: Dict,
        analysis: Dict,
        node_count: int,
        category_counts: Dict[str, int],
        covered_topics: List[str],
    ) -> Dict:
        cat    = alignment["category"]
        topics = analysis.get("topics", [])[:3]
        topic_str = ", ".join(topics) if topics else "this content"

        aligned_n = category_counts.get("aligned", 0)
        drift_n   = category_counts.get("drift", 0)
        expand_n  = category_counts.get("expansion", 0)

        random.seed(hash(analysis.get("description", "")))

        messages = {
            "aligned": [
                f"Solid match — {topic_str} maps directly to your research thread.",
                f"Your focus is sharp. {topic_str} strengthens the cognitive map.",
                f"This page deepens your understanding of {topic_str}.",
            ],
            "expansion": [
                f"Interesting branch — {topic_str} is adjacent to your core goal.",
                f"You're widening the lens. {topic_str} may reveal unexpected connections.",
                f"Adjacent territory: {topic_str} could complement your main research.",
            ],
            "drift": [
                f"This content ({topic_str}) sits outside your current research thread.",
                "Your research thread is drifting from the current goal.",
                "A detour — consider whether this serves your main inquiry.",
            ],
        }

        # ── Recommend next topics ──────────────────────────────────────────
        covered_lower = {t.lower() for t in covered_topics}
        next_topics: List[str] = []

        # Find related topics from the current page that have not been covered yet.
        for t in topics:
            candidates = _TOPIC_EXPANSION.get(t.lower(), [])
            for c in candidates:
                if c.lower() not in covered_lower and c not in next_topics:
                    next_topics.append(c)
                if len(next_topics) >= 3:
                    break
            if len(next_topics) >= 3:
                break

        if next_topics:
            topics_hint = ", ".join(next_topics[:3])
            if cat == "drift":
                suggestion = f"Return to the main research thread. Try searching: {topics_hint}."
            elif cat == "expansion":
                suggestion = f"This direction is worth a deeper look. Try exploring: {topics_hint}."
            else:
                suggestion = f"Based on this page, try exploring next: {topics_hint}."
        else:
            # Fall back to behavioral suggestions when no expansion topics are available.
            fallback = {
                "aligned":   "Keep going in this direction; your research thread is clear.",
                "expansion": f"Consider how {topic_str} connects to the core goal before going deeper.",
                "drift":     f"Your goal is \"{goal}\". Try searching for content more directly related to it.",
            }
            suggestion = fallback.get(cat, "")

        # ── Cognitive summary ───────────────────────────────────────────────
        if node_count <= 1:
            summary = f"First page mapped for: {goal}"
        elif node_count == 2:
            summary = f"Building early connections around {goal}."
        elif drift_n == 0:
            summary = (
                f"Highly focused session — {aligned_n} aligned page"
                f"{'s' if aligned_n != 1 else ''} on {goal}."
            )
        elif drift_n >= 2 and drift_n > aligned_n:
            summary = (
                f"Session shows attention fragmentation — "
                f"{drift_n} drift pages detected. Refocus on {goal}?"
            )
        elif expand_n > aligned_n:
            summary = (
                f"Exploratory session: mapping territory around {goal} "
                f"more than diving deep."
            )
        else:
            summary = (
                f"Mostly on-track with {goal}, with some exploration "
                f"({expand_n} expansion page{'s' if expand_n != 1 else ''})."
            )

        return {
            "soft_message":      random.choice(messages.get(cat, messages["aligned"])),
            "suggestion":        suggestion,
            "cognitive_summary": summary,
        }

    # ── Real LLM path ─────────────────────────────────────────────────────

    async def _real_reflect(
        self,
        goal: str,
        alignment: Dict,
        analysis: Dict,
        graph_nodes: List[Dict],
        category_counts: Dict[str, int],
        node_count: int,
        covered_topics: List[str],
    ) -> Dict:
        cat    = alignment["category"]
        score  = round(alignment["score"] * 100)
        topics = analysis.get("topics", [])[:5]

        recent = sorted(
            [n for n in graph_nodes if n["id"] != "goal"],
            key=lambda n: n.get("visit_index", 0),
        )[-3:]
        recent_summary = "; ".join(
            f"{n['title']} ({n['alignment_category']}, {round(n['relevance_score'] * 100)}%)"
            for n in recent
        ) or "First page"

        covered_str = ", ".join(covered_topics[:20]) if covered_topics else "none yet"

        prompt = f"""You are a cognitive reflection AI that mirrors a researcher's attention patterns.

Research Goal: {goal}
Current Page: {analysis.get('description', '')}
Current Page Topics: {', '.join(topics)}
Alignment: {cat.upper()} ({score}%)
Session Progress: {node_count} pages — Aligned: {category_counts.get('aligned', 0)}, Expanding: {category_counts.get('expansion', 0)}, Drifting: {category_counts.get('drift', 0)}
Recent browsing: {recent_summary}
Topics already covered in this session: {covered_str}

Return ONLY a JSON object (no markdown):
{{
  "soft_message": "<empathetic 1-sentence status, max 15 words, present tense, mention actual topics>",
  "suggestion": "<recommend 2-3 specific search topics the user has NOT yet covered, phrased as: 'Try exploring: X, Y, Z' — topics must be directly related to the current research direction and NOT in the covered list>",
  "cognitive_summary": "<1-2 sentence narrative of the overall session pattern, max 35 words>"
}}

Rules:
- suggestion must name concrete topics, not generic advice like "keep exploring"
- suggested topics must NOT already be in the covered list
- if alignment is drift, suggest topics that bridge back to the research goal
- be warm and specific, no filler phrases"""

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.zhipu.client.chat.completions.create(
                    model="glm-4-flash",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.65,
                    max_tokens=1024,
                ),
            )
            raw = response.choices[0].message.content.strip()
            return json.loads(_strip_fences(raw))

        except Exception as exc:
            print(f"[ReflectionAgent] LLM error: {exc} — falling back to mock")
            return self._mock_reflect(
                goal, alignment, analysis, node_count, category_counts, covered_topics
            )
