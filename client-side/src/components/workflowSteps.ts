/** Linear workflow screens shown in the sidebar stepper. */

export const WORKFLOW_STEPS = [
  { label: "Select template", iconCss: "e-icons e-file-document", text: "1" },
  { label: "Editor", iconCss: "e-icons e-edit", text: "2" },
  { label: "Review", iconCss: "e-icons e-checklist", text: "3" },
  { label: "Sign", iconCss: "e-icons e-stamp", text: "4" },
] as const;

const CONTRACT_PATH = /^\/(?:editor|review|publish)\/([^/]+)/;

export function contractIdFromPath(pathname: string): string | null {
  return pathname.match(CONTRACT_PATH)?.[1] ?? null;
}

export function activeStepFromPath(pathname: string): number {
  if (pathname.startsWith("/publish")) return 3;
  if (pathname.startsWith("/review")) return 2;
  if (pathname.startsWith("/editor")) return 1;
  return 0;
}

/** Route for a workflow step. Step 0 is always `/`. Later steps need a contract id. */
export function pathForWorkflowStep(index: number, contractId: string | null): string | null {
  if (index <= 0) return "/";
  if (!contractId) return null;
  const bases = ["/editor", "/review", "/publish"] as const;
  const base = bases[index - 1];
  return base ? `${base}/${contractId}` : null;
}
