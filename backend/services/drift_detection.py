from typing import List, Dict


class DriftDetector:
    """
    Alignment score = weighted combination of:
      - relevance_score  (0.80 weight) — keyword-based TF-IDF approximation
      - overlap_score    (0.20 weight) — Jaccard-style: what fraction of THIS
                                         page's topics appear in prior knowledge

    Using page_set (not accumulated current_set) as denominator prevents score
    dilution as the session graph grows — the question is "how much of what
    THIS page talks about is already in my research thread?" not "how much of
    everything I've ever seen does this page cover?"

    Thresholds (≥0.65 aligned, 0.35-0.65 expansion, <0.35 drift) approximate
    the core/peripheral/off-task distinction from cognitive load theory.
    """

    ALIGNED_THRESHOLD   = 0.65
    EXPANSION_THRESHOLD = 0.35

    def compute_alignment(
        self,
        relevance_score: float,
        page_topics: List[str],
        current_topics: List[str],
    ) -> Dict:
        if page_topics:
            page_set    = {t.lower() for t in page_topics}
            current_set = {t.lower() for t in current_topics}
            # Jaccard numerator / page denominator:
            # "what fraction of this page's topics are already in my graph?"
            overlap_ratio = len(page_set & current_set) / max(len(page_set), 1)
            overlap_score = min(overlap_ratio * 1.5, 1.0)
        else:
            overlap_score = relevance_score

        # Relevance carries 80% weight — it's the primary signal.
        # Overlap is a 20% bonus/penalty for contextual continuity.
        alignment_score = round(relevance_score * 0.80 + overlap_score * 0.20, 3)

        if alignment_score >= self.ALIGNED_THRESHOLD:
            category = "aligned"
        elif alignment_score >= self.EXPANSION_THRESHOLD:
            category = "expansion"
        else:
            category = "drift"

        return {
            "score":           alignment_score,
            "category":        category,
            "relevance_score": relevance_score,
            "overlap_score":   round(overlap_score, 3),
        }
