/**
 * Demo workflow mapping — single linear flow.
 *
 * The template gallery cards are backed by the backend catalog
 * (`wwwroot/Templates/templates.json`), whose ids/filenames differ from the
 * seed template records. To open a template card directly on its canonical
 * pre-seeded demo contract (no dialog, no account, no placeholder), we map:
 *
 *   catalog id → canonical demo contractId   (Dashboard card click)
 *   contract.templateId → catalog id         (Editor/Review/Sign .docx lookup)
 *
 * The editor imports the *real* `.docx` for fidelity, resolved from the catalog
 * entry's `docxUrl` (the seed `templateFileSlug` values do not match the served
 * PascalCase filenames, so we never use them for the URL).
 */

import type { TemplateCatalogEntry } from "../models";

/** Catalog card id → the demo contract it opens. */
export const CONTRACT_ID_BY_CATALOG_ID: Record<string, string> = {
  "tpl-service-agreement": "ctr-northwind-service",
  "tpl-mutual-nda": "ctr-contoso-nda",
  "tpl-purchase-contract": "ctr-fabrikam-purchase",
};

/** Seed contract.templateId → catalog id (bridges the NDA id mismatch). */
export const CATALOG_ID_BY_TEMPLATE_ID: Record<string, string> = {
  "tpl-service-agreement": "tpl-service-agreement",
  "tpl-nda-mutual": "tpl-mutual-nda",
  "tpl-purchase-contract": "tpl-purchase-contract",
};

/** Resolve the catalog entry for a contract's templateId. */
export function resolveCatalogEntry(
  catalog: TemplateCatalogEntry[] | null | undefined,
  templateId: string
): TemplateCatalogEntry | null {
  if (!catalog) return null;
  const catalogId = CATALOG_ID_BY_TEMPLATE_ID[templateId] ?? templateId;
  return catalog.find((t) => t.id === catalogId) ?? null;
}
