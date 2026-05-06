from typing import List, Dict, Tuple

# ── Timeline layout constants ──────────────────────────────────────────────
#
#   Y axis  (top→bottom = relevance high→low)
#   ─────────────────────────────────────────
#   y = 80   ALIGNED   (≥ 65 % relevance)
#   y = 280  GOAL anchor + EXPANSION (35-65 %)
#   y = 480  DRIFT  (< 35 %)
#
#   X axis  (left→right = visit order, chronological)
#   ──────────────────────────────────────────────────
#   x = 80   GOAL node (fixed anchor)
#   x = 380, 670, 960 … every subsequent page visit

GOAL_X: float = 80
GOAL_Y: float = 280   # same Y as expansion zone — connections branch ↑ aligned, → expansion, ↓ drift

X_START: float = 380
X_STEP:  float = 290  # ~190 px node width + 100 px gap

Y_ZONE: Dict[str, float] = {
    "aligned":   80,
    "expansion": 280,
    "drift":     480,
}


class GraphBuilder:
    def __init__(self):
        self._visit_count = 0   # global chronological counter (all page types)

    # ── Node construction ─────────────────────────────────────────────────
    def add_node(
        self,
        page_id: str,
        title: str,
        semantic_type: str,
        alignment_category: str,
        topics: List[str],
        relevance_score: float,
        description: str,
    ) -> Dict:
        # Visual type: drift/expansion always override semantic label
        if alignment_category == "drift":
            visual_type = "drift"
        elif alignment_category == "expansion":
            visual_type = "expansion"
        else:
            visual_type = semantic_type  # theory | explanation | spatial

        x = X_START + self._visit_count * X_STEP
        y = Y_ZONE.get(alignment_category, GOAL_Y)

        visit_index = self._visit_count
        self._visit_count += 1

        return {
            "id": page_id,
            "title": title,
            "semantic_type": visual_type,
            "alignment_category": alignment_category,
            "topics": topics,
            "relevance_score": relevance_score,
            "description": description,
            "x": x,
            "y": y,
            "visit_index": visit_index,
        }

    # ── Edge computation ──────────────────────────────────────────────────
    def compute_edges(self, nodes: List[Dict]) -> List[Dict]:
        """
        Pure sequential chain layout:
          • GOAL → first non-drift node (animated, origin connection)
          • non-drift[i] → non-drift[i+1]  (chronological chain)
          • Drift nodes float isolated — no edges in or out
        """
        edges: List[Dict] = []
        goal = next((n for n in nodes if n["id"] == "goal"), None)
        if not goal:
            return edges

        all_visited = sorted(
            [n for n in nodes if n["id"] != "goal"],
            key=lambda n: n.get("visit_index", 0),
        )
        non_drift = [n for n in all_visited if n["alignment_category"] != "drift"]

        # 1. GOAL → first non-drift node only (origin pulse)
        if non_drift:
            first = non_drift[0]
            edges.append({
                "id": f"e-goal-{first['id']}",
                "source": "goal",
                "target": first["id"],
                "strength": first["relevance_score"],
                "animated": True,
            })

        # 2. Sequential chain: each non-drift node → the next one visited
        for i in range(len(non_drift) - 1):
            a, b = non_drift[i], non_drift[i + 1]
            avg_strength = round((a["relevance_score"] + b["relevance_score"]) / 2, 3)
            edges.append({
                "id": f"e-seq-{a['id']}-{b['id']}",
                "source": a["id"],
                "target": b["id"],
                "strength": avg_strength,
                "animated": False,
            })

        return edges

    def reset(self):
        self.__init__()
