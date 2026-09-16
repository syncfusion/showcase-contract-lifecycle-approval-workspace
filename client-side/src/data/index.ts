/**
 * Deterministic seed data for the mock service layer.
 *
 * 100% synthetic fictional entities — no PII, no real contract text.
 * Deterministic volumes cover edge cases: overdue review, unresolved comments,
 * missing optional token, published-with-artifacts, and signed contract.
 *
 * Relational arrays (versions, assignments, activity) are wired once at
 * contracts module load time.
 */

export { templatesSeed } from "./templates";
export { accountsSeed } from "./accounts";
export { clausesSeed } from "./clauses";
export { reviewersSeed } from "./reviewers";
export { contractsTyped as contractsSeed } from "./contracts";
export { versionsSeed } from "./versions";
export { assignmentsSeed } from "./assignments";
export { activitySeed } from "./activity";
export { signaturesSeed } from "./signatures";

