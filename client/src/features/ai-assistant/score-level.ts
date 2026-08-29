/**
 * Advisory 0–1 score → coarse bucket. Shared by Suggested Category confidence
 * and KB Suggestions relevance so there is one threshold policy, not two.
 * Not a calibrated probability — surfaced only as a text label.
 */
export function scoreLevel(value: number): "high" | "medium" | "low" {
  if (value >= 0.75) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}
