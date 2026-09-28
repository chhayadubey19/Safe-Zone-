/**
 * Dedup / incident linking — the Phase 4 "key demo moment".
 *
 * On report submit, before creating a new incident, the new report is matched
 * against UNRESOLVED incidents at the same venue:
 *   - same issue_key  → match (regardless of wording)
 *   - similar complaint text (token overlap > OVERLAP_THRESHOLD) → match
 *
 * The citizen then chooses on the confirm screen: add their report to the
 * existing incident, or file it as a different issue.
 */

export const OVERLAP_THRESHOLD = 0.5;

/** Small stopword list (English + common Hindi function words). */
const STOPWORDS = new Set([
  // English
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "is", "are",
  "was", "were", "with", "this", "that", "it", "its", "for", "from", "by",
  "be", "been", "has", "have", "had", "not", "no", "there", "their", "they",
  "them", "we", "you", "your", "i", "my", "me", "he", "she", "his", "her",
  "will", "can", "could", "should", "would", "very", "too", "so", "as",
  // Hindi function words (transliterated-agnostic: Devanagari forms)
  "का", "की", "के", "में", "से", "है", "हैं", "था", "थे", "और", "यह", "वह",
  "पर", "को", "ने", "भी", "जो", "सकता", "नहीं", "हो", "हुआ", "हुई", "रहा", "रही",
]);

/**
 * Tokenize for overlap comparison: lowercase, split on any run that is not a
 * letter / digit / combining mark (Unicode-aware; Devanagari matras and the
 * anusvara stay attached to their base consonant — "बंद" is ONE token), drop
 * stopwords and single characters.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Jaccard overlap between two token lists: |A ∩ B| / |A ∪ B|. */
export function jaccard(a: string[], b: string[]): number {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const t of new Set(a)) if (setB.has(t)) shared++;
  return shared / union.size;
}

/** One unresolved incident at the venue, with its reports' complaint texts. */
export interface MatchCandidate {
  incidentId: string;
  title: string;
  issueKey: string;
  status: string;
  reportCount: number;
  /** Complaint texts of the reports linked to this incident. */
  texts: string[];
}

export interface IncidentMatchResult {
  incidentId: string;
  title: string;
  reportCount: number;
  /** "issue_key" — same checklist item; "text" — token overlap above threshold. */
  matchedBy: "issue_key" | "text";
  /** 1 for issue_key matches; the best text similarity otherwise. */
  similarity: number;
}

/**
 * Find the best match for a new report among unresolved incidents at a venue.
 * issue_key matches win outright; otherwise the highest text similarity above
 * OVERLAP_THRESHOLD (ties broken by report count) is returned.
 */
export function findBestMatch(
  candidates: MatchCandidate[],
  opts: { issueKey?: string | null; text?: string | null },
): IncidentMatchResult | null {
  const issueKey = opts.issueKey && opts.issueKey !== "other" ? opts.issueKey : null;

  // 1. Same checklist item → match, regardless of wording.
  if (issueKey) {
    const byKey = candidates.filter((c) => c.issueKey === issueKey);
    if (byKey.length > 0) {
      const best = byKey.sort((a, b) => b.reportCount - a.reportCount)[0];
      return {
        incidentId: best.incidentId,
        title: best.title,
        reportCount: best.reportCount,
        matchedBy: "issue_key",
        similarity: 1,
      };
    }
  }

  // 2. Similar complaint text (token overlap above the threshold).
  const text = (opts.text ?? "").trim();
  if (!text) return null;
  const newTokens = tokenize(text);
  if (newTokens.length === 0) return null;

  let best: IncidentMatchResult | null = null;
  for (const c of candidates) {
    const similarity = Math.max(
      0,
      ...c.texts.map((t) => jaccard(newTokens, tokenize(t))),
    );
    if (similarity <= OVERLAP_THRESHOLD) continue;
    if (
      !best ||
      similarity > best.similarity ||
      (similarity === best.similarity && c.reportCount > best.reportCount)
    ) {
      best = {
        incidentId: c.incidentId,
        title: c.title,
        reportCount: c.reportCount,
        matchedBy: "text",
        similarity,
      };
    }
  }
  return best;
}
