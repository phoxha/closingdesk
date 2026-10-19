import type { AttorneyReview, Finding } from "@/lib/types";

export function latestReview(findingId: string, reviews: AttorneyReview[]): AttorneyReview | null {
  const related = reviews.filter((review) => review.findingId === findingId);
  return related.length > 0 ? related[related.length - 1] : null;
}

/** Material findings stay open until the attorney marks them acceptable or resolved. */
export function isOpenFinding(finding: Pick<Finding, "id" | "status">, reviews: AttorneyReview[]): boolean {
  if (finding.status === "MATCH" || finding.status === "EQUIVALENT") return false;
  const latest = latestReview(finding.id, reviews);
  if (!latest) return true;
  return latest.action !== "resolved" && latest.action !== "acceptable";
}

export function openCount(findings: Array<Pick<Finding, "id" | "status">>, reviews: AttorneyReview[]): number {
  return findings.filter((finding) => isOpenFinding(finding, reviews)).length;
}
