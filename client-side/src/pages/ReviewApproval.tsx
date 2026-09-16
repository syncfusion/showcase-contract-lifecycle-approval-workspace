/**
 * Review & Approval — Screen 3 (`/review/:contractId`)
 *
 * Real two-document comparison shown side by side. The baseline is the pristine
 * template `.docx` (resolved from the contract's templateId via the catalog); the
 * revised document is the live-edited doc carried from the editor's "Compare
 * versions" click (session store), falling back to the baseline when the review is
 * opened directly (a valid "no changes" comparison). The pristine original is shown
 * in the LEFT editor; the baseline + revised are sent to the backend
 * `POST /api/documenteditor/CompareDocuments` (DocIO redline) and the resulting
 * Comparison.docx is opened in the RIGHT editor, whose native revisions pane
 * provides Accept / Reject. The two editors scroll in sync.
 *
 * States: comparing (Skeleton), service-down/error with retry, no-changes note.
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
import { ButtonComponent } from "@syncfusion/ej2-react-buttons";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { LabelChip } from "../components/StatusChip";
import { StateMessage } from "../components/StateMessage";
import { useContract, useTemplateCatalog } from "../hooks/useAsync";
import {
  compareDocuments,
  documentEndpoint,
  fetchDocxAsBase64,
  importTemplateAsSfdt,
} from "../services/documentService";
import { getEditedDoc } from "../services/editedDocStore";
import { resolveCatalogEntry } from "../data/demoMapping";
import "../styles/pages.css";

DocumentEditorContainerComponent.Inject(Ribbon);

type Phase = "comparing" | "ready" | "error";

export default function ReviewApproval() {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const contract = useContract(contractId);
  const catalog = useTemplateCatalog();

  const catalogEntry = useMemo(
    () => resolveCatalogEntry(catalog.data, contract.data?.templateId ?? ""),
    [catalog.data, contract.data?.templateId]
  );

  const containerRef = useRef<DocumentEditorContainerType | null>(null);
  const originalContainerRef = useRef<DocumentEditorContainerType | null>(null);
  const comparedSfdtRef = useRef<string | null>(null);
  const originalSfdtRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("comparing");
  const [noChanges, setNoChanges] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [baselineId, setBaselineId] = useState("template");
  const [revisedId, setRevisedId] = useState("edited");

  // Run the comparison once the contract + catalog entry are resolved. Baseline
  // = template .docx; revised = edited doc from the editor (or baseline if none).
  useEffect(() => {
    if (!contract.data || !catalogEntry) return;
    let cancelled = false;
    setPhase("comparing");
    setNoChanges(false);
    setShowRevisions(false);
    setEditorMounted(false);
    comparedSfdtRef.current = null;
    originalSfdtRef.current = null;

    (async () => {
      try {
        // Pristine original for the left editor + baseline (base64) for the compare.
        const [originalSfdt, baseline] = await Promise.all([
          importTemplateAsSfdt(catalogEntry.docxUrl),
          fetchDocxAsBase64(catalogEntry.docxUrl),
        ]);
        const revised = getEditedDoc(contract.data!.id) ?? baseline;
        const sfdt = await compareDocuments(baseline, revised, "Maya Chen");
        if (cancelled) return;
        originalSfdtRef.current = originalSfdt;
        comparedSfdtRef.current = sfdt;
        // Defer editor mount one turn (React 19 StrictMode insertBefore guard).
        setTimeout(() => {
          if (!cancelled) setEditorMounted(true);
        }, 50);
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contract.data, catalogEntry, attempt]);

  // Fired from both editors' `created` callbacks. Opens both documents and wires
  // synchronized scrolling once both editor instances and both SFDTs are ready.
  const wireWhenReady = useCallback(() => {
    const run = () => {
      const originalEditor = originalContainerRef.current?.documentEditor;
      const resultEditor = containerRef.current?.documentEditor;
      const originalSfdt = originalSfdtRef.current;
      const comparedSfdt = comparedSfdtRef.current;
      if (!originalEditor || !resultEditor || !originalSfdt || !comparedSfdt) return;
      try {
        originalEditor.open(originalSfdt);
        resultEditor.showRevisions = false;
        resultEditor.open(comparedSfdt);
        setShowRevisions(false);
        setNoChanges(resultEditor.revisions.length === 0);

        // Synchronized scrolling with a re-entrancy guard (setScrollPosition
        // itself raises viewChange).
        let syncing = false;
        originalEditor.viewChange = () => {
          if (syncing) return;
          syncing = true;
          resultEditor.selection.setScrollPosition(originalEditor.selection.getScrollPosition());
          syncing = false;
        };
        resultEditor.viewChange = () => {
          if (syncing) return;
          syncing = true;
          originalEditor.selection.setScrollPosition(resultEditor.selection.getScrollPosition());
          syncing = false;
        };

        setPhase("ready");
      } catch {
        setPhase("error");
      }
    };
    // Only initialize once both editors exist; each created callback retries.
    if (originalContainerRef.current?.documentEditor && containerRef.current?.documentEditor) run();
  }, []);

  const toggleReviewPane = useCallback(() => {
    const resultEditor = containerRef.current?.documentEditor;
    if (!resultEditor) return;
    setShowRevisions((prev) => {
      const next = !prev;
      resultEditor.showRevisions = next;
      return next;
    });
  }, []);

  const editorServiceUrl = useMemo(() => documentEndpoint("").replace(/\/$/, ""), []);

  const versionOptions = useMemo(
    () => [
      { id: "template", label: "Template original" },
      { id: "edited", label: "Your edited document" },
    ],
    []
  );

  const loading = contract.loading || catalog.loading;
  const notFound = !loading && (contract.error || !contract.data);
  const canCompare = Boolean(baselineId && revisedId && baselineId !== revisedId);
  const baselineLabel = versionOptions.find((v) => v.id === baselineId)?.label ?? "Template original";
  const revisedLabel = versionOptions.find((v) => v.id === revisedId)?.label ?? "Your edited document";

  if (loading) return <ReviewSkeleton />;
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
    <section aria-labelledby="review-title">
      <div className="claw-screen-heading">
        <div>
          <span className="claw-eyebrow">Review &amp; approval</span>
          <h1 id="review-title">{contract.data!.title}</h1>
          <p className="muted">
            Comparing {baselineLabel} → {revisedLabel}
          </p>
        </div>
        <div className="claw-actions">
          <ButtonComponent cssClass="claw-button" type="button" onClick={() => navigate(`/editor/${contract.data!.id}`)}>
            Back to editor
          </ButtonComponent>
          <ButtonComponent
            cssClass="claw-button primary"
            isPrimary
            type="button"
            onClick={() => navigate(`/publish/${contract.data!.id}`)}
          >
            Continue to sign
          </ButtonComponent>
        </div>
      </div>

      <div className="claw-comparison-toolbar">
        <div className="claw-comparison-side">
          <span className="claw-eyebrow">Baseline</span>
          <DropDownListComponent
            cssClass="claw-form-dropdown claw-version-select"
            dataSource={versionOptions}
            fields={{ text: "label", value: "id" }}
            value={baselineId}
            change={(e) => {
              if (e.value) setBaselineId(String(e.value));
            }}
            placeholder="Select original version"
          />
        </div>
        <span className="claw-comparison-arrow" aria-hidden="true">→</span>
        <div className="claw-comparison-side">
          <span className="claw-eyebrow">Revised</span>
          <DropDownListComponent
            cssClass="claw-form-dropdown claw-version-select"
            dataSource={versionOptions}
            fields={{ text: "label", value: "id" }}
            value={revisedId}
            change={(e) => {
              if (e.value) setRevisedId(String(e.value));
            }}
            placeholder="Select revised version"
          />
        </div>
        <ButtonComponent
          cssClass="claw-button"
          type="button"
          disabled={!canCompare}
          onClick={() => setAttempt((a) => a + 1)}
        >
          Compare documents
        </ButtonComponent>
        {noChanges && phase === "ready" ? (
          <LabelChip text="No changes detected" cssClass="e-success" />
        ) : null}
      </div>

      {phase === "error" ? (
        <StateMessage
          severity="Error"
          title="Comparison unavailable"
          action={
            <ButtonComponent cssClass="claw-button" type="button" onClick={() => setAttempt((a) => a + 1)}>
              Retry comparison
            </ButtonComponent>
          }
        >
          <p>
            The Document Editor service could not compare the documents. Ensure ContractWorkspace.DocumentService is
            running, then retry.
          </p>
        </StateMessage>
      ) : (
        <div className="claw-comparison-workspace">
          <div className="claw-editor-loading" hidden={phase === "ready"} aria-live="polite" aria-busy={phase !== "ready"}>
            <SkeletonComponent width="40%" height="16px" style={{ marginBottom: 12 }} />
            <SkeletonComponent width="100%" height="560px" />
          </div>
          {editorMounted ? (
            <div className="claw-compare-grid">
              <div className="claw-compare-col">
                <div className="claw-compare-col-head">
                  <span>Original Document</span>
                </div>
                <CompareEditorIsland
                  id="claw-review-editor-original"
                  editorRef={originalContainerRef}
                  serviceUrl={editorServiceUrl}
                  onCreated={wireWhenReady}
                />
              </div>
              <div className="claw-compare-col">
                <div className="claw-compare-col-head">
                  <span>Result Document (with tracked changes)</span>
                  <ButtonComponent
                    cssClass="claw-button subtle"
                    type="button"
                    iconCss="e-icons e-eye"
                    onClick={toggleReviewPane}
                  >
                    {showRevisions ? "Hide Review Pane" : "Show Review Pane"}
                  </ButtonComponent>
                </div>
                <CompareEditorIsland
                  id="claw-review-editor-result"
                  editorRef={containerRef}
                  serviceUrl={editorServiceUrl}
                  onCreated={wireWhenReady}
                />
              </div>
            </div>
          ) : (
            <div className="claw-comparison-panel">
              <ReviewSkeleton compact />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const CompareEditorIsland = memo(
  function CompareEditorIsland({
    id,
    editorRef,
    serviceUrl,
    onCreated,
  }: {
    id: string;
    editorRef: Ref<DocumentEditorContainerType>;
    serviceUrl: string;
    onCreated: () => void;
  }) {
    return (
      <DocumentEditorContainerComponent
        id={id}
        ref={editorRef}
        height="600px"
        created={onCreated}
        serviceUrl={serviceUrl}
        enableToolbar={false}
        showPropertiesPane={false}
        currentUser="Maya Chen"
      />
    );
  },
  () => true
);

function ReviewSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-live="polite" aria-busy="true">
      {!compact ? (
        <>
          <SkeletonComponent width="40%" height="28px" style={{ marginBottom: 10 }} />
          <SkeletonComponent width="60%" height="14px" style={{ marginBottom: 20 }} />
        </>
      ) : null}
      <SkeletonComponent width="100%" height={compact ? "560px" : "620px"} />
    </div>
  );
}
