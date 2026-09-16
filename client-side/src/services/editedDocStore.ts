/**
 * In-memory (+ sessionStorage backup) carrier for the live-edited document,
 * keyed by contractId. Document content is never persisted across a hard
 * reload of the app, but within a session it must survive the editor → review
 * navigation so Screen 3 can compare the *edited* document (revised) against
 * the pristine template `.docx` (baseline).
 *
 * The editor stashes a base64 DOCX on its "Compare versions" click; the Review
 * screen reads it and clears nothing (so revisiting works). If absent (e.g. the
 * review is opened directly without editing), the caller falls back to
 * baseline-vs-baseline (a valid "no changes" comparison).
 */

const memory = new Map<string, string>();
const STORAGE_PREFIX = "claw-edited-doc:";

/** Stash the edited DOCX (base64) for a contract. */
export function setEditedDoc(contractId: string, docxBase64: string): void {
  memory.set(contractId, docxBase64);
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${contractId}`, docxBase64);
  } catch {
    // sessionStorage may be unavailable/quota-exceeded — memory is the source of truth.
  }
}

/** Retrieve the edited DOCX (base64) for a contract, or null if none. */
export function getEditedDoc(contractId: string): string | null {
  const inMemory = memory.get(contractId);
  if (inMemory) return inMemory;
  try {
    const backup = sessionStorage.getItem(`${STORAGE_PREFIX}${contractId}`);
    if (backup) {
      memory.set(contractId, backup);
      return backup;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Clear the edited DOCX for a contract (optional cleanup). */
export function clearEditedDoc(contractId: string): void {
  memory.delete(contractId);
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${contractId}`);
  } catch {
    // ignore
  }
}
