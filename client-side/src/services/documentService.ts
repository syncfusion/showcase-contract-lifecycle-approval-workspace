/**
 * Document Editor web service URL wrapper.
 *
 * Centralizes the configurable, environment-driven URL for the stateless
 * ASP.NET Core Document Editor service (Import, RestrictEditing,
 * SystemClipboard, SpellCheck, ExportSFDT, ExportPdf). The URL is never
 * hardcoded in component code; all consumers use this module.
 */

declare const __DOCUMENT_EDITOR_SERVICE_URL__: string;

import type { TemplateCatalogEntry } from "../models";

export function getDocumentServiceUrl(): string {
  // Vite define-time value, falls back to env var at runtime if provided
  const envUrl = import.meta.env.VITE_DOCUMENT_EDITOR_SERVICE_URL;
  return envUrl ?? __DOCUMENT_EDITOR_SERVICE_URL__;
}

/** Full endpoint URL builder for `api/documenteditor/*` routes. */
export function documentEndpoint(path: string): string {
  const base = getDocumentServiceUrl().replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}/api/documenteditor/${cleanPath}`;
}

/** Static template file URL (served from service wwwroot/Templates/). */
export function templateFileUrl(slug: string): string {
  const base = getDocumentServiceUrl().replace(/\/+$/, "");
  return `${base}/Templates/${slug}.docx`;
}

/**
 * Normalize a catalog entry's `docxUrl` against the currently configured
 * Document Editor service base. The catalog ships with `http://localhost:5212`
 * URLs, but the service base env (`VITE_DOCUMENT_EDITOR_SERVICE_URL`) may
 * differ (https, port override, remote deployment). This preserves the
 * `/Templates/<file>.docx` path while swapping the origin, so the editor always
 * fetches the .docx from the live service. Mirrors the reference app's
 * `absoluteDocxUrl()` helper.
 */
export function normalizeDocxUrl(docxUrl: string): string {
  if (!docxUrl) return "";
  const base = getDocumentServiceUrl().replace(/\/+$/, "");
  try {
    const u = new URL(docxUrl, base);
    // Keep only the path (and any query) and re-prefix with the configured base.
    const pathAndQuery = `${u.pathname}${u.search}`;
    return `${base}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  } catch {
    // Not a parseable URL — best-effort prefix.
    return docxUrl.startsWith("/") ? `${base}${docxUrl}` : `${base}/${docxUrl}`;
  }
}

/** Health probe URL. */
export function healthUrl(): string {
  return `${getDocumentServiceUrl().replace(/\/+$/, "")}/health`;
}

/**
 * Fetches the template catalog (wwwroot/Templates/templates.json) served as a
 * static file by the Document Editor service. Each entry carries the .docx URL,
 * a thumbnail data URI, the template name/type, and the bare merge-field names.
 */
export async function getTemplateCatalog(): Promise<TemplateCatalogEntry[]> {
  const base = getDocumentServiceUrl().replace(/\/+$/, "");
  const res = await fetch(`${base}/Templates/templates.json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Template catalog unavailable (HTTP ${res.status})`);
  }
  return (await res.json()) as TemplateCatalogEntry[];
}

/**
 * Imports a .docx file into the Document Editor by streaming it through the
 * backend `POST /api/documenteditor/Import` endpoint, which returns SFDT JSON
 * the editor can open directly via `editor.open(sfdt)`. Mirrors the reference
 * app's `fetchSfdtFromDocx({ url })` helper.
 *
 * @param docxUrl Absolute URL to the .docx (typically `entry.docxUrl`).
 * @returns SFDT JSON string suitable for `DocumentEditor.open()`.
 */
export async function importTemplateAsSfdt(docxUrl: string): Promise<string> {
  const fileRes = await fetch(normalizeDocxUrl(docxUrl));
  if (!fileRes.ok) {
    throw new Error(`Template file unavailable (HTTP ${fileRes.status})`);
  }
  const blob = await fileRes.blob();
  const form = new FormData();
  form.append("files", blob, "template.docx");
  const importRes = await fetch(documentEndpoint("Import"), {
    method: "POST",
    body: form,
  });
  if (!importRes.ok) {
    throw new Error(`Document Editor Import failed (HTTP ${importRes.status})`);
  }
  const sfdt = await importRes.text();
  if (!sfdt) {
    throw new Error("Document Editor Import returned an empty SFDT payload");
  }
  return sfdt;
}

/** Decodes a base64 string (no data: prefix) into a Uint8Array. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Imports a base64-encoded DOCX into the Document Editor by decoding it to a
 * Blob and streaming it through the backend `POST /api/documenteditor/Import`
 * endpoint, which returns SFDT JSON the editor can open via `editor.open(sfdt)`.
 * The base64-DOCX counterpart to `importTemplateAsSfdt` (which takes a URL);
 * used to reopen the live-edited document carried in the session store.
 *
 * @param base64 Base64-encoded DOCX bytes (no data: prefix).
 * @returns SFDT JSON string suitable for `DocumentEditor.open()`.
 */
export async function importDocxBase64AsSfdt(base64: string): Promise<string> {
  const blob = new Blob([base64ToBytes(base64)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const form = new FormData();
  form.append("files", blob, "contract.docx");
  const importRes = await fetch(documentEndpoint("Import"), {
    method: "POST",
    body: form,
  });
  if (!importRes.ok) {
    throw new Error(`Document Editor Import failed (HTTP ${importRes.status})`);
  }
  const sfdt = await importRes.text();
  if (!sfdt) {
    throw new Error("Document Editor Import returned an empty SFDT payload");
  }
  return sfdt;
}

/** Converts a Blob to a base64 string (no data: prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Serializes an editor SFDT payload to a DOCX file via the backend
 * `POST /api/documenteditor/ExportSFDT` endpoint and returns it as a base64
 * string (no data: prefix). Used to carry the live-edited document into the
 * Review screen for real document comparison.
 *
 * @param sfdt Editor SFDT JSON (from `documentEditor.serialize()`).
 * @returns Base64-encoded DOCX bytes.
 */
export async function exportSfdtAsDocxBase64(sfdt: string): Promise<string> {
  const res = await fetch(documentEndpoint("ExportSFDT"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Content: sfdt,
      FileName: "contract.docx",
      Format: ".docx",
    }),
  });
  if (!res.ok) {
    throw new Error(`Document Editor ExportSFDT failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  return blobToBase64(blob);
}

/**
 * Serializes an editor SFDT payload to a DOCX Blob via the backend
 * `POST /api/documenteditor/ExportSFDT` endpoint. This is the "working" DOCX
 * (still carrying comments/tracked changes) that is then fed to the clean-DOCX
 * and clean-PDF export endpoints on the Sign & Publish screen.
 *
 * @param sfdt Editor SFDT JSON (from `documentEditor.serialize()`).
 * @returns DOCX Blob.
 */
export async function exportSfdtAsDocxBlob(sfdt: string): Promise<Blob> {
  const res = await fetch(documentEndpoint("ExportSFDT"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Content: sfdt,
      FileName: "contract.docx",
      Format: ".docx",
    }),
  });
  if (!res.ok) {
    throw new Error(`Document Editor ExportSFDT failed (HTTP ${res.status})`);
  }
  return res.blob();
}

/**
 * Produces a clean, publication-ready DOCX by uploading a working DOCX to the
 * backend `POST /api/documenteditor/ExportCleanDocx` endpoint, which strips
 * comments and tracked changes (DocIO `Revisions.RejectAll()` +
 * `Comments.Clear()`) before saving. Used for the "final DOCX" download on the
 * Sign & Publish screen.
 *
 * @param docx Working DOCX Blob (e.g. from `exportSfdtAsDocxBlob`).
 * @returns Cleaned DOCX Blob.
 */
export async function exportCleanDocx(docx: Blob): Promise<Blob> {
  const form = new FormData();
  form.append("files", docx, "contract.docx");
  const res = await fetch(documentEndpoint("ExportCleanDocx"), {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Document Editor ExportCleanDocx failed (HTTP ${res.status})`);
  }
  return res.blob();
}

/**
 * Produces a clean PDF by uploading a working DOCX to the backend
 * `POST /api/documenteditor/ExportPdf` endpoint, which strips comments and
 * tracked changes before rendering (DocIORenderer). Used for the PDF preview
 * and "final PDF" download on the Sign & Publish screen.
 *
 * @param docx Working DOCX Blob (e.g. from `exportSfdtAsDocxBlob`).
 * @returns Clean PDF Blob.
 */
export async function exportCleanPdf(docx: Blob): Promise<Blob> {
  const form = new FormData();
  form.append("files", docx, "contract.docx");
  const res = await fetch(documentEndpoint("ExportPdf"), {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Document Editor ExportPdf failed (HTTP ${res.status})`);
  }
  return res.blob();
}

/**
 * Compares two DOCX documents (base64) via the backend
 * `POST /api/documenteditor/CompareDocuments` endpoint, which returns a
 * redlined Comparison.docx produced by DocIO `WordDocument.Compare`. The
 * comparison DOCX is then fed back through `Import` (docx→SFDT) so the result
 * can be opened directly in a `DocumentEditorContainerComponent` with its
 * native revisions pane (Accept/Reject).
 *
 * @param originalBase64 Baseline ("previous version") DOCX, base64.
 * @param revisedBase64  Revised ("your edits") DOCX, base64.
 * @param author         Revision author label for the redline.
 * @returns SFDT JSON string of the redlined comparison document.
 */
export async function compareDocuments(
  originalBase64: string,
  revisedBase64: string,
  author: string
): Promise<string> {
  const res = await fetch(documentEndpoint("CompareDocuments"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginalDocumentData: originalBase64,
      RevisedDocumentData: revisedBase64,
      Author: author,
    }),
  });
  if (!res.ok) {
    throw new Error(`Document Editor CompareDocuments failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const form = new FormData();
  form.append("files", blob, "comparison.docx");
  const importRes = await fetch(documentEndpoint("Import"), {
    method: "POST",
    body: form,
  });
  if (!importRes.ok) {
    throw new Error(`Document Editor Import (comparison) failed (HTTP ${importRes.status})`);
  }
  const sfdt = await importRes.text();
  if (!sfdt) {
    throw new Error("Comparison import returned an empty SFDT payload");
  }
  return sfdt;
}

/**
 * Fills the document's Word merge fields (`«Field»` MERGEFIELDs) with data
 * server-side via DocIO, and returns the merged document as SFDT ready for
 * `documentEditor.open()`. This is the reliable counterpart to a client-side
 * find/replace: it resolves the real MERGEFIELDs that `editor.search` cannot
 * match via `POST /api/documenteditor/MailMerge`.
 *
 * The current editor SFDT is first serialized to a DOCX (base64) so the merge
 * runs against the live, in-editor document (including any edits/clauses the
 * user has made), then the field values are supplied as a single merge row
 * under a `Records` group (matches `MailMergeDataAdapter.ToDataTable`).
 *
 * @param sfdt         Editor SFDT JSON (from `documentEditor.serialize()`).
 * @param values       Merge field name → value map (bare names, no guillemets).
 * @param clearFields  When `true` (default), fields with no matching value are
 *                     cleared; pass `false` to preserve unfilled MERGEFIELDs
 *                     (single-field "Replace" flow).
 * @returns Merged SFDT JSON string suitable for `DocumentEditor.open()`.
 */
export async function mailMerge(
  sfdt: string,
  values: Record<string, string>,
  clearFields = true
): Promise<string> {
  const documentData = await exportSfdtAsDocxBase64(sfdt);
  const res = await fetch(documentEndpoint("MailMerge"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FileName: "contract.docx",
      DocumentData: documentData,
      MailMergeData: JSON.stringify({ Records: [values] }),
      ClearFields: clearFields,
    }),
  });
  if (!res.ok) {
    throw new Error(`Document Editor MailMerge failed (HTTP ${res.status})`);
  }
  const merged = await res.text();
  if (!merged) {
    throw new Error("Document Editor MailMerge returned an empty SFDT payload");
  }
  return merged;
}

/**
 * Fetches a template `.docx` (by its served URL) and returns it base64-encoded,
 * for use as the baseline in a document comparison.
 *
 * @param docxUrl Template `.docx` URL (e.g. `templateFileUrl(slug)`).
 * @returns Base64-encoded DOCX bytes.
 */
export async function fetchDocxAsBase64(docxUrl: string): Promise<string> {
  const res = await fetch(normalizeDocxUrl(docxUrl));
  if (!res.ok) {
    throw new Error(`Template file unavailable (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  return blobToBase64(blob);
}
