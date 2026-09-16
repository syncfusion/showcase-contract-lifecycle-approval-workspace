/**
 * Sign & Publish — Screen 4 (`/publish/:contractId`)
 *
 * The DOCX editor is the main surface (left, ~70%) showing the loaded real
 * `.docx`; a right-side "Approval signature" panel (~30%) holds signer fields,
 * a SignatureComponent pad, Clear + Insert buttons, and an always-visible
 * disclaimer. Drawing a signature and clicking Insert selects the template's
 * signature-block bookmark (`SignatureBlock_*`) and drops the captured image
 * (PNG) there via `editor.editor.insertImage` (track changes suspended) — the
 * same select-bookmark-then-insert pattern as clause slots — then persists a
 * mock signature record. Falls back to the caret if the document has no block.
 *
 * The signature is image-based (not certificate-backed). Preview & export
 * produces a clean PDF preview and DOCX/PDF download via the document service.
 *
 * States: editor/contract loading (Skeleton), service-down panel.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DocumentEditorContainerComponent,
  Ribbon,
  type DocumentEditorContainerComponent as DocumentEditorContainerType,
} from "@syncfusion/ej2-react-documenteditor";
import { SignatureComponent } from "@syncfusion/ej2-react-inputs";
import { TextBoxComponent } from "@syncfusion/ej2-react-inputs";
import { ButtonComponent } from "@syncfusion/ej2-react-buttons";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { DialogComponent } from "@syncfusion/ej2-react-popups";
import { StateMessage } from "../components/StateMessage";
import {
  PdfViewerComponent,
  Toolbar as PdfToolbar,
  Magnification,
  Navigation,
  TextSelection,
  TextSearch,
  Print as PdfPrint,
  Inject as PdfInject,
} from "@syncfusion/ej2-react-pdfviewer";
import { showToast } from "../components/AppToast";
import { useContract, useTemplateCatalog } from "../hooks/useAsync";
import { contractService } from "../services/contractService";
import {
  documentEndpoint,
  importTemplateAsSfdt,
  importDocxBase64AsSfdt,
  exportSfdtAsDocxBlob,
  exportCleanDocx,
  exportCleanPdf,
} from "../services/documentService";
import { getEditedDoc, clearEditedDoc } from "../services/editedDocStore";
import { resolveCatalogEntry } from "../data/demoMapping";
import type { TemplateCatalogEntry } from "../models";
import "../styles/pages.css";

DocumentEditorContainerComponent.Inject(Ribbon);

/** Local, version-matched PDF Viewer standalone resources (pdfium WASM).
 *  Must be an ABSOLUTE URL: the viewer's blob Web Worker calls importScripts(),
 *  which cannot resolve a root-relative path against its opaque blob: base. */
const PDF_RESOURCE_URL = `${window.location.origin}${import.meta.env.BASE_URL}ej2-pdfviewer-lib`;

/** Sanitize a contract title into a safe download file base name. */
function toFileBase(title: string): string {
  const cleaned = title.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
  return cleaned || "contract";
}

/** Trigger a browser download for a Blob via a transient object URL. */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SignPublish() {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const contract = useContract(contractId);
  const catalog = useTemplateCatalog();

  const catalogEntry = useMemo<TemplateCatalogEntry | null>(
    () => resolveCatalogEntry(catalog.data, contract.data?.templateId ?? ""),
    [catalog.data, contract.data?.templateId]
  );
  const catalogEntryRef = useRef<TemplateCatalogEntry | null>(null);
  catalogEntryRef.current = catalogEntry;

  const containerRef = useRef<DocumentEditorContainerType | null>(null);
  const signatureRef = useRef<SignatureComponent | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  const [serviceDown, setServiceDown] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [signed, setSigned] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");

  // Export / preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const docxBlobRef = useRef<Blob | null>(null);
  const pdfBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!contract.data || !catalogEntry) {
      setEditorMounted(false);
      setEditorReady(false);
      return;
    }
    const id = window.setTimeout(() => setEditorMounted(true), 50);
    return () => window.clearTimeout(id);
  }, [contract.data, catalogEntry]);

  const handleEditorCreated = useCallback(() => {
    const run = async () => {
      const container = containerRef.current;
      const entry = catalogEntryRef.current;
      if (!container?.documentEditor || !entry) return;
      try {
        // Prefer the live-edited document carried from the Editor (session
        // store); fall back to the pristine template when opened directly.
        const edited = contractId ? getEditedDoc(contractId) : null;
        const sfdt = edited
          ? await importDocxBase64AsSfdt(edited)
          : await importTemplateAsSfdt(entry.docxUrl);
        container.documentEditor.open(sfdt);
        setEditorReady(true);
      } catch {
        setServiceDown(true);
        setEditorReady(true);
      }
    };
    if (containerRef.current?.documentEditor) void run();
    else requestAnimationFrame(() => void run());
  }, [contractId]);

  const editorServiceUrl = useMemo(() => documentEndpoint("").replace(/\/$/, ""), []);

  function handleClearSignature() {
    if (signed) return;
    signatureRef.current?.clear();
    setSignatureEmpty(true);
  }

  async function handleInsertSignature() {
    if (signed) return;
    const editor = containerRef.current?.documentEditor;
    const sig = signatureRef.current;
    if (!editor || !sig || sig.isEmpty()) {
      showToast("Draw a signature before inserting.", "Approval signature");
      return;
    }
    if (!signerName.trim()) {
      showToast("Enter the signer's name before inserting.", "Approval signature");
      return;
    }
    const imageData = sig.getSignature("Png");
    const insertedAtBlock = insertSignatureAtBlock(
      editor,
      imageData,
      `Approval signature of ${signerName.trim()}`
    );
    try {
      await contractService.attachSignature({
        contractId: contract.data!.id,
        signer: { name: signerName.trim(), title: signerTitle.trim() },
        imageData,
      });
      setSigned(true);
      showToast(
        insertedAtBlock
          ? "Signature inserted at the signature block and attached to the contract."
          : "No signature block in this document — inserted at the caret instead.",
        "Approval signature"
      );
    } catch {
      showToast("Signature inserted, but saving the record failed.", "Approval signature");
    }
  }

  const handlePreviewExport = useCallback(async () => {
    const editor = containerRef.current?.documentEditor;
    if (!editor) return;
    setPreviewOpen(true);
    setExporting(true);
    setExportError(null);
    setPdfDataUrl(null);
    docxBlobRef.current = null;
    pdfBlobRef.current = null;
    try {
      const sfdt = editor.serialize();
      const workingDocx = await exportSfdtAsDocxBlob(sfdt);
      const [cleanDocx, cleanPdf] = await Promise.all([
        exportCleanDocx(workingDocx),
        exportCleanPdf(workingDocx),
      ]);
      docxBlobRef.current = cleanDocx;
      pdfBlobRef.current = cleanPdf;
      const dataUrl = await blobToDataUrl(cleanPdf);
      setPdfDataUrl(dataUrl);
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : "Export failed. Ensure the Document Editor service is running."
      );
    } finally {
      setExporting(false);
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
    setPdfDataUrl(null);
    setExportError(null);
    docxBlobRef.current = null;
    pdfBlobRef.current = null;
  }, []);

  // Start a fresh document flow: drop this contract's cached edited document so
  // reopening it loads the pristine template, then return to the Dashboard (step 1).
  const handleStartNew = useCallback(() => {
    if (contractId) clearEditedDoc(contractId);
    navigate("/");
  }, [contractId, navigate]);

  const fileBase = useMemo(
    () => toFileBase(contract.data?.title ?? "contract"),
    [contract.data?.title]
  );

  function handleDownloadDocx() {
    if (docxBlobRef.current) downloadBlob(docxBlobRef.current, `${fileBase}.docx`);
  }
  function handleDownloadPdf() {
    if (pdfBlobRef.current) downloadBlob(pdfBlobRef.current, `${fileBase}.pdf`);
  }

  const loading = contract.loading || catalog.loading;
  const notFound = !loading && (contract.error || !contract.data);

  if (loading) return <PublishSkeleton />;
  if (notFound) {
    return (
      <StateMessage
        severity="Error"
        title="Contract not found"
        action={
          <ButtonComponent cssClass="claw-button" type="button" onClick={() => navigate("/")}>
            Back to dashboard
          </ButtonComponent>
        }
      >
        <p>The selected contract could not be loaded.</p>
      </StateMessage>
    );
  }

  return (
    <section aria-labelledby="publish-title">
      <div className="claw-screen-heading">
        <div>
          <span className="claw-eyebrow">Sign &amp; publish</span>
          <h1 id="publish-title">{contract.data!.title}</h1>
          <p className="muted">Draw an approval signature and insert it into the document's signature block.</p>
        </div>
        <div className="claw-actions">
          <ButtonComponent cssClass="claw-button" type="button" onClick={() => navigate(`/review/${contract.data!.id}`)}>
            Back to review
          </ButtonComponent>
          <ButtonComponent cssClass="claw-button" type="button" onClick={handleStartNew}>
            Start new document
          </ButtonComponent>
          <ButtonComponent
            cssClass="claw-button primary"
            isPrimary
            type="button"
            disabled={!editorReady}
            onClick={handlePreviewExport}
          >
            Preview &amp; export
          </ButtonComponent>
        </div>
      </div>

      {serviceDown ? (
        <StateMessage severity="Error" title="Document Editor service unavailable">
          <p>The contract document could not be imported. Start ContractWorkspace.DocumentService and reopen.</p>
        </StateMessage>
      ) : null}

      <div className="claw-publish-layout">
        <div className="claw-publish-editor">
          <div className="claw-editor-loading" hidden={editorReady} aria-live="polite" aria-busy={!editorReady}>
            <SkeletonComponent width="40%" height="16px" style={{ marginBottom: 12 }} />
            <SkeletonComponent width="100%" height="560px" />
          </div>
          <div className="claw-editor-host">
            {editorMounted ? (
              <PublishEditorIsland
                editorRef={containerRef}
                serviceUrl={editorServiceUrl}
                onCreated={handleEditorCreated}
              />
            ) : null}
          </div>
        </div>

        <aside className="claw-signature-panel" aria-label="Approval signature">
          <h2>Approval signature</h2>
          <div className="claw-field-stack">
            <label className="claw-eyebrow" htmlFor="signer-name">Signer name</label>
            <TextBoxComponent
              id="signer-name"
              placeholder="e.g. Maya Chen"
              value={signerName}
              enabled={!signed}
              input={(e: { value: string }) => setSignerName(e.value)}
            />
            <label className="claw-eyebrow" htmlFor="signer-title">Signer title</label>
            <TextBoxComponent
              id="signer-title"
              placeholder="e.g. VP, Legal"
              value={signerTitle}
              enabled={!signed}
              input={(e: { value: string }) => setSignerTitle(e.value)}
            />
          </div>

          <span className="claw-eyebrow" style={{ display: "block", margin: "14px 0 6px" }}>Draw signature</span>
          <div className={`claw-signature-box${signed ? " is-locked" : ""}`}>
            <SignatureComponent
              ref={signatureRef}
              disabled={signed}
              change={() => setSignatureEmpty(signatureRef.current?.isEmpty() ?? true)}
            />
            <span className="claw-signature-line" aria-hidden="true" />
          </div>

          <div className="claw-signature-actions">
            <ButtonComponent cssClass="claw-button" type="button" disabled={signed} onClick={handleClearSignature}>
              Clear
            </ButtonComponent>
            <ButtonComponent
              cssClass="claw-button primary"
              isPrimary
              type="button"
              disabled={signed || signatureEmpty || !editorReady}
              onClick={handleInsertSignature}
            >
              Insert signature
            </ButtonComponent>
          </div>

          {signed ? (
            <StateMessage severity="Success" title="Signature attached">
              <p>Signature attached to this contract (session mock). It can be inserted once.</p>
            </StateMessage>
          ) : null}

          <StateMessage severity="Warning" title="Image-based approval signature">
            <p>This is an image-based approval signature, not a certificate-backed digital signature.</p>
          </StateMessage>

        </aside>
      </div>

      {previewOpen ? (
        <DialogComponent
          width="90%"
          height="90%"
          isModal
          visible
          showCloseIcon
          header="Export preview — clean PDF"
          cssClass="claw-export-dialog"
          target="body"
          close={handleClosePreview}
          footerTemplate={() => (
            <div className="claw-dialog-footer">
              <ButtonComponent
                cssClass="claw-button"
                type="button"
                onClick={handleStartNew}
              >
                Start new document
              </ButtonComponent>
              <ButtonComponent
                cssClass="claw-button"
                type="button"
                disabled={exporting || !!exportError}
                onClick={handleDownloadDocx}
              >
                Download DOCX
              </ButtonComponent>
              <ButtonComponent
                cssClass="claw-button primary"
                isPrimary
                type="button"
                disabled={exporting || !!exportError}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </ButtonComponent>
            </div>
          )}
        >
          <div className="claw-export-viewer">
            {exporting ? (
              <div className="claw-export-skeleton" aria-live="polite" aria-busy="true">
                <div className="claw-export-skeleton-toolbar">
                  <SkeletonComponent width="120px" height="16px" />
                  <SkeletonComponent width="180px" height="16px" />
                  <SkeletonComponent width="90px" height="16px" />
                </div>
                <div className="claw-export-skeleton-body">
                  <SkeletonComponent width="min(760px, 80%)" height="100%" />
                </div>
              </div>
            ) : exportError ? (
              <StateMessage severity="Error" title="Export failed">
                <p>{exportError}</p>
              </StateMessage>
            ) : pdfDataUrl ? (
              <PdfViewerComponent
                id="claw-export-pdf-viewer"
                documentPath={pdfDataUrl}
                resourceUrl={PDF_RESOURCE_URL}
                height="100%"
                style={{ height: "100%" }}
              >
                <PdfInject
                  services={[
                    PdfToolbar,
                    Magnification,
                    Navigation,
                    TextSelection,
                    TextSearch,
                    PdfPrint,
                  ]}
                />
              </PdfViewerComponent>
            ) : null}
          </div>
        </DialogComponent>
      ) : null}
    </section>
  );
}

/** Convert a Blob to a `data:...;base64,` URL (for PDF Viewer `documentPath`). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read PDF blob"));
    reader.readAsDataURL(blob);
  });
}

const PublishEditorIsland = memo(
  function PublishEditorIsland({
    editorRef,
    serviceUrl,
    onCreated,
  }: {
    editorRef: Ref<DocumentEditorContainerType>;
    serviceUrl: string;
    onCreated: () => void;
  }) {
    return (
      <DocumentEditorContainerComponent
        id="claw-publish-editor"
        ref={editorRef}
        height="620px"
        created={onCreated}
        serviceUrl={serviceUrl}
        enableToolbar
        toolbarMode="Ribbon"
        ribbonLayout="Simplified"
        showPropertiesPane={false}
        currentUser="Maya Chen"
      />
    );
  },
  () => true
);

/**
 * Insert the signature image into the template's signature-block bookmark
 * (authored by TemplateGenerator as `SignatureBlock_*`, wrapping the
 * "[Signature Pad Placeholder …]" paragraph) and insert over that selection
 * so the image replaces the placeholder in place. Falls back to caret
 * insertion when the document has no matching bookmark. Returns true when
 * the image landed in the block itself.
 */
function insertSignatureAtBlock(
  editor: DocumentEditorContainerType["documentEditor"],
  imageData: string,
  alternateText: string
): boolean {
  const target = findSignatureBlockBookmark(editor);
  const previous = editor.enableTrackChanges;
  try {
    editor.enableTrackChanges = false;
    if (target) editor.selection.selectBookmark(target);
    editor.editor.insertImage(imageData, 180, 80, alternateText);
  } finally {
    editor.enableTrackChanges = previous;
  }
  return target !== null;
}

/** Find the signature-block bookmark, or null when the document has none. */
function findSignatureBlockBookmark(
  editor: DocumentEditorContainerType["documentEditor"]
): string | null {
  for (const name of safeGetBookmarks(editor)) {
    if (name.startsWith("SignatureBlock_") || name === "bm_signature") return name;
  }
  return null;
}

/** getBookmarks can throw while the editor is mid-layout; treat that as "none". */
function safeGetBookmarks(editor: DocumentEditorContainerType["documentEditor"]): string[] {
  try {
    return editor.getBookmarks();
  } catch {
    return [];
  }
}

function PublishSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true">
      <SkeletonComponent width="40%" height="28px" style={{ marginBottom: 10 }} />
      <SkeletonComponent width="60%" height="14px" style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 16 }}>
        <SkeletonComponent width="68%" height="620px" />
        <SkeletonComponent width="30%" height="620px" />
      </div>
    </div>
  );
}
