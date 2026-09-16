/**
 * Editor Workspace — Screen 2 (`/editor/:contractId`)
 *
 * Core showcase screen and the single editor entry point. A Syncfusion
 * DocumentEditorContainerComponent (lazy route) with a Ribbon-style toolbar
 * loads the mapped template's real `.docx` (import fidelity), plus a side panel
 * (Merge fields → MockDataDialog preview, Clause library, Editing restrictions),
 * two feature checkboxes (comments/timestamps, section restrictions) that
 * default OFF, a "View as" role switcher, and a "Compare versions" hand-off that
 * carries the live-edited document to Review (Screen 3).
 *
 * States: editor loading, service-down banner, contract-not-found, empty.
 */

import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type Ref,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DocumentEditorContainerComponent,
  Ribbon,
  type DocumentEditorContainerComponent as DocumentEditorContainerType,
} from "@syncfusion/ej2-react-documenteditor";
import {
  TabComponent,
  TabItemDirective,
  TabItemsDirective,
  TreeViewComponent,
} from "@syncfusion/ej2-react-navigations";
import type { SelectEventArgs } from "@syncfusion/ej2-navigations";
import { ListViewComponent } from "@syncfusion/ej2-react-lists";
import { ComboBoxComponent, DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { ButtonComponent, CheckBoxComponent, type ChangeEventArgs } from "@syncfusion/ej2-react-buttons";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { showToast } from "../components/AppToast";
import { LabelChip, RiskChip } from "../components/StatusChip";
import { StateMessage } from "../components/StateMessage";
import MockDataDialog from "../components/editor/MockDataDialog";
import { useClauses, useContract, useReviewers, useTemplateCatalog } from "../hooks/useAsync";
import { contractService } from "../services/contractService";
import {
  documentEndpoint,
  exportSfdtAsDocxBase64,
  importTemplateAsSfdt,
  mailMerge,
} from "../services/documentService";
import { setEditedDoc } from "../services/editedDocStore";
import { resolveCatalogEntry } from "../data/demoMapping";
import type { Clause, ContractDetail, ReviewAssignment, Reviewer, TemplateCatalogEntry } from "../models";
import "../styles/pages.css";

DocumentEditorContainerComponent.Inject(Ribbon);

type SideTab = "merge" | "clauses" | "assignments";
type Role = "Author" | "Legal" | "Finance" | "Customer";

const SIDE_TABS: { id: SideTab; text: string }[] = [
  { id: "merge", text: "Merge fields" },
  { id: "clauses", text: "Clause library" },
  { id: "assignments", text: "Editing restrictions" },
];

const ROLES: { id: Role; protection: "Off" | "CommentsOnly" | "ReadOnly" }[] = [
  { id: "Author", protection: "Off" },
  { id: "Legal", protection: "CommentsOnly" },
  { id: "Finance", protection: "ReadOnly" },
  { id: "Customer", protection: "Off" },
];
const ROLE_IDS: Role[] = ROLES.map((r) => r.id);
const DEFAULT_FONT_FAMILY = "Calibri";
const DEMO_COMMENT_TEXT =
  "Please review the highlighted terms before circulating this draft.";

/**
 * Extract a human message from a rejected mock-service call. The service rejects
 * with an `AppError` object ({ code, message, retryable }), which is not an
 * `Error` instance — so `e.message` alone would be lost. Falls back to a default.
 */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return fallback;
}

/** Run an editor mutation with track changes forced off, then restore it. */
function withTrackChangesSuspended(
  editor: DocumentEditorContainerType["documentEditor"],
  fn: () => void
): void {
  const previous = editor.enableTrackChanges;
  try {
    editor.enableTrackChanges = false;
    fn();
  } finally {
    editor.enableTrackChanges = previous;
  }
}

export default function EditorWorkspace() {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const contract = useContract(contractId);
  const catalog = useTemplateCatalog();
  const clauses = useClauses();
  const reviewers = useReviewers();

  const catalogEntry = useMemo<TemplateCatalogEntry | null>(
    () => resolveCatalogEntry(catalog.data, contract.data?.templateId ?? ""),
    [catalog.data, contract.data?.templateId]
  );

  const containerRef = useRef<DocumentEditorContainerType | null>(null);
  const contractRef = useRef(contract.data);
  contractRef.current = contract.data;
  const catalogEntryRef = useRef<TemplateCatalogEntry | null>(null);
  catalogEntryRef.current = catalogEntry;
  const roleRef = useRef<Role>("Author");
  const demoCommentInsertedRef = useRef(false);
  // Tracks `${sectionBookmark}::${user}` signatures already turned into editable
  // regions on the live document, so re-running the protection effect (on role
  // switch, etc.) re-enforces the lock without inserting duplicate regions.
  // Reset when the document reloads (regions live in the document, not React).
  const appliedSectionsRef = useRef<Set<string>>(new Set());
  const [tab, setTab] = useState<SideTab>("merge");
  const [serviceDown, setServiceDown] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [restrictionsEnabled, setRestrictionsEnabled] = useState(false);
  const [previewWithData, setPreviewWithData] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>("Author");
  const [insertedClauses, setInsertedClauses] = useState<
    { clauseId: string; name: string; risk: string; slot: string }[]
  >([]);
  const [editorMounted, setEditorMounted] = useState(false);
  const [mockDialogOpen, setMockDialogOpen] = useState(false);
  const [documentSlots, setDocumentSlots] = useState<{ id: string; label: string }[]>([]);
  roleRef.current = currentRole;

  // Mount EJ2 Document Editor after the workspace chrome commits. React 19
  // StrictMode would otherwise create+destroy the editor in one turn, which
  // leaves toolbar nodes React no longer owns (insertBefore NotFoundError).
  // The catalog must be resolved too, since the editor imports the mapped
  // template's real .docx (resolved from the catalog entry).
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
    const run = () => {
      const container = containerRef.current;
      if (!container?.documentEditor) return;
      const detail = contractRef.current;
      const entry = catalogEntryRef.current;
      if (!detail || !entry) return;
      demoCommentInsertedRef.current = false;
      appliedSectionsRef.current = new Set();
      container.currentUser = roleRef.current === "Author" ? "Maya Chen" : roleRef.current;
      container.setDefaultCharacterFormat({ fontFamily: DEFAULT_FONT_FAMILY, fontSize: 11 });
      container.documentEditor.setDefaultCharacterFormat({
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: 11,
      });
      void loadContractIntoEditor(container, entry, {
        onReady: () => {
          applyCalibriDefault(container.documentEditor);
          setEditorReady(true);
          // Surface the template's real clause-slot bookmarks (the
          // "[Insert … Clause: …]" placeholders) as the insertion targets.
          setDocumentSlots(resolveDocumentSlots(safeGetBookmarks(container.documentEditor)));
        },
        onServiceDown: () => {
          setServiceDown(true);
          setEditorReady(true);
        },
      });
    };
    if (containerRef.current?.documentEditor) run();
    else requestAnimationFrame(run);
  }, []);

  // Must keep the trailing slash: the DocumentEditorContainer appends built-in
  // action names directly (e.g. serviceUrl + "RestrictEditing"), so stripping
  // it yields ".../documenteditorRestrictEditing" → 404 when enforcing
  // protection. Import/Export use manual fetches and are unaffected.
  const editorServiceUrl = useMemo(() => documentEndpoint(""), []);

  // Apply role-based protection + comments/track-changes when toggled. Do this
  // via the EJ2 instance — never by changing DocumentEditorContainerComponent
  // props after mount. Checking comments inserts one dated review comment on
  // the open document and shows the comments pane. Protection is gated on
  // `restrictionsEnabled` (when off, editing is unrestricted).
  useEffect(() => {
    if (!containerRef.current || !editorReady) return;
    const editor = containerRef.current.documentEditor;
    const roleConfig = ROLES.find((r) => r.id === currentRole);
    const author = currentRole === "Author" ? "Maya Chen" : currentRole;
    containerRef.current.currentUser = author;
    try {
      editor.enableComment = commentsEnabled;
      if (commentsEnabled) {
        if (!demoCommentInsertedRef.current) {
          const inserted = insertDemoCommentOnOpenDocument(editor, author);
          if (inserted) {
            demoCommentInsertedRef.current = true;
            showToast("Added a review comment with author and timestamp.", "Comments");
          }
        }
        editor.showComments = true;
      } else {
        editor.showComments = false;
      }
      editor.enableTrackChanges = commentsEnabled;
      const assignments = contract.data?.assignments ?? [];
      if (!restrictionsEnabled) {
        editor.isReadOnly = false;
        editor.editor.stopProtection("claw-demo");
      } else if (assignments.length > 0) {
        // Per-section model: lock the whole document, then unlock each assigned
        // section as an editable region keyed to its reviewer's role. The
        // View-as role (currentUser, set above) decides which regions the
        // current viewer can actually edit.
        applyAllRestrictions(editor, assignments, reviewers.data ?? [], appliedSectionsRef.current);
      } else if (roleConfig?.protection === "ReadOnly") {
        // Fallback (no assignments): whole-document role protection.
        editor.isReadOnly = true;
      } else if (roleConfig?.protection === "CommentsOnly") {
        editor.editor.enforceProtection("claw-demo", "CommentsOnly");
      } else {
        editor.isReadOnly = false;
        editor.editor.stopProtection("claw-demo");
      }
    } catch {
      // stopProtection errors when not protected; ignore in demo mode.
    }
  }, [currentRole, editorReady, commentsEnabled, restrictionsEnabled, contract.data?.assignments, reviewers.data]);

  /**
   * Serialize the editor, export it to a DOCX (base64) via the backend, and
   * stash it keyed by contractId so downstream screens (Review, Sign & Publish)
   * can reopen the live-edited document. Non-fatal: those screens fall back to
   * the pristine template baseline when nothing is stashed.
   */
  async function persistEditedDoc() {
    if (!contract.data) return;
    const container = containerRef.current;
    try {
      if (container?.documentEditor) {
        const sfdt = container.documentEditor.serialize();
        const base64 = await exportSfdtAsDocxBase64(sfdt);
        setEditedDoc(contract.data.id, base64);
      }
    } catch {
      // Non-fatal — downstream screens handle a missing edited doc gracefully.
    }
  }

  /**
   * Carry the live-edited document to Review (Screen 3): stash it, then
   * navigate. Review compares this (revised) against the pristine template
   * `.docx` (baseline).
   */
  async function handleCompareVersions() {
    if (!contract.data) return;
    await persistEditedDoc();
    navigate(`/review/${contract.data.id}`);
  }

  /**
   * Fill a single «MERGEFIELD» via the server-side DocIO mail merge, preserving
   * every other unfilled field (`clearFields: false`). Client-side find/replace
   * cannot reliably match a Word MERGEFIELD's result text, so we round-trip the
   * document through the merge endpoint with just this one field populated.
   */
  async function replaceToken(token: string, value: string) {
    const editor = containerRef.current?.documentEditor;
    if (!editor) return;
    try {
      const sfdt = editor.serialize();
      const merged = await mailMerge(sfdt, { [token]: value }, false);
      editor.open(merged);
      showToast(`Replaced «${token}» with "${value}".`, "Merge field");
    } catch {
      showToast("Could not replace the merge field. Try again.", "Merge field");
    }
  }

  /** Open the single "Preview with data" affordance (mock CRM datasets). */
  function handlePreviewWithData() {
    setMockDialogOpen(true);
  }

  /**
   * Apply a selected mock dataset to the loaded document by filling every
   * «MERGEFIELD» server-side via DocIO mail merge (the reference workflow).
   * Serializes the current doc, runs the merge, then reopens the merged SFDT so
   * all fields resolve in one pass. Invoked by the MockDataDialog on confirm.
   */
  async function applyMockMergeData(values: Record<string, string>, datasetName: string) {
    const editor = containerRef.current?.documentEditor;
    setMockDialogOpen(false);
    if (!editor) return;
    try {
      const sfdt = editor.serialize();
      const merged = await mailMerge(sfdt, values);
      editor.open(merged);
      setPreviewWithData(true);
      showToast(`Populated the contract with "${datasetName}" data.`, "Preview with data");
    } catch {
      showToast("Could not apply the mock dataset. Try again.", "Preview with data");
    }
  }

  /** Insert a clause into the document at the selected bookmark/slot. */
  async function handleInsertClause(clause: Clause, slot: string) {
    if (!contract.data) return;
    try {
      const result = await contractService.insertClause({
        contractId: contract.data.id,
        clauseId: clause.id,
        slot,
      });
      setInsertedClauses((prev) => [
        ...prev,
        { clauseId: clause.id, name: result.insertedClauseName, risk: result.riskLevel, slot: result.insertedAtBookmark },
      ]);
      const editor = containerRef.current?.documentEditor;
      if (editor) {
        const inserted = insertClauseAtSlot(editor, slot, clause.body);
        if (!inserted) {
          showToast(
            `No "${humanizeSection(slot)}" slot in this document — inserted at the caret instead.`,
            "Clause library"
          );
          return;
        }
      }
      showToast(`Inserted ${clause.name} at ${slot}.`, "Clause library");
    } catch {
      showToast("Could not insert the clause. Try again.");
    }
  }

  async function handleAssign(section: string, reviewerId: string, level: "ReadOnly" | "CommentsOnly") {
    if (!contract.data) return;
    const reviewer = (reviewers.data ?? []).find((r) => r.id === reviewerId);
    let assignment: ReviewAssignment | null = null;
    try {
      assignment = await contractService.assignSection({
        contractId: contract.data.id,
        sectionId: section,
        reviewerId,
        protectionLevel: level,
      });
    } catch (e) {
      const message = errorMessage(e, "Assignment failed.");
      // Re-assigning a section that was already assigned this session is a
      // no-op on the store — fall through and (re)apply the live region rather
      // than hard-failing, so the demo stays interactive. Any other failure
      // (unknown reviewer, missing contract) surfaces its real message.
      if (!/already assigned/i.test(message)) {
        showToast(message, "Editing restrictions");
        return;
      }
    }
    const sectionName = assignment?.sectionName ?? humanizeSection(section);
    const reviewerName = assignment?.reviewerName ?? reviewer?.name ?? "the reviewer";
    const user = reviewer?.role ?? assignment?.reviewerRole ?? reviewerName;
    const editor = containerRef.current?.documentEditor;
    // Only "Comments only" grants an editable region; "Read-only" keeps the
    // section locked for everyone (it still shows in the restriction strip).
    // Applying a live region requires the restriction lock to be on.
    if (editor && restrictionsEnabled && level === "CommentsOnly") {
      try {
        editor.editor.stopProtection("claw-demo");
      } catch {
        // Not yet protected — inserting the region below is safe.
      }
      const applied = applyEditableRegionForAssignment(editor, section, user);
      if (applied) appliedSectionsRef.current.add(`${section}::${user}`);
      try {
        editor.editor.enforceProtection("claw-demo", "ReadOnly");
      } catch {
        // Ignore: enforceProtection is a no-op when already protected.
      }
      showToast(
        applied
          ? `${sectionName} is now editable for ${user}. Switch "View as" to ${user} to preview.`
          : `Assigned ${sectionName} to ${reviewerName}, but this template has no matching section to unlock.`,
        "Editing restrictions"
      );
      return;
    }
    showToast(
      restrictionsEnabled
        ? `Assigned ${sectionName} to ${reviewerName} (read-only).`
        : `Assigned ${sectionName} to ${reviewerName}. Enable "Apply section editing restrictions" to lock the document.`,
      "Editing restrictions"
    );
  }

  const loading = contract.loading || catalog.loading;
  const notFound = !loading && (contract.error || !contract.data);

  return (
    <section aria-labelledby="editor-title">
      {loading ? (
        <EditorSkeleton />
      ) : notFound ? (
        <ContractNotFound onBack={() => navigate("/")} />
      ) : (
        <EditorErrorBoundary key={contract.data!.id}>
        <div className="claw-editor-screen">
          <div className="claw-screen-heading">
            <div>
              <span className="claw-eyebrow">Editor</span>
              <h1 id="editor-title">{contract.data!.title}</h1>
              <p className="muted">
                {previewWithData
                  ? "Preview with customer data · "
                  : "Draft with merge fields, clause library, and role-based editing restrictions"}
              </p>
            </div>
            <div className="claw-actions">
              <ButtonComponent cssClass="claw-button primary" isPrimary type="button" onClick={handleCompareVersions}>
                Compare versions
              </ButtonComponent>
            </div>
          </div>

          {serviceDown ? (
            <StateMessage severity="Error" title="Document Editor service unavailable">
              <p>The template document could not be imported. Start the ContractWorkspace.DocumentService and reopen.</p>
            </StateMessage>
          ) : null}

          <div className="claw-feature-controls" aria-label="Document Editor feature preview controls">
            <div className="claw-feature-toggle">
              <CheckBoxComponent
                checked={commentsEnabled}
                change={(e: ChangeEventArgs) => setCommentsEnabled(!!e.checked)}
                cssClass="claw-feature-check"
              />
              <span>
                <strong>Enable comments &amp; timestamps</strong>
                <small>Insert a review comment on the open document with author and date/time, and record edits as tracked revisions.</small>
              </span>
            </div>
            <div className="claw-feature-toggle">
              <CheckBoxComponent
                checked={restrictionsEnabled}
                change={(e: ChangeEventArgs) => setRestrictionsEnabled(!!e.checked)}
                cssClass="claw-feature-check"
              />
              <span>
                <strong className="claw-feature-title">
                  <span>Apply section editing restrictions</span>
                  <TooltipComponent
                    content="With sections assigned below, a reviewer can edit only the sections assigned to their role; otherwise Legal is limited to comments and Finance is read-only."
                    position="TopCenter"
                    cssClass="claw-feature-tip"
                  >
                    <span className="claw-info-icon e-icons e-circle-info" role="img" aria-label="More about section editing restrictions" tabIndex={0} />
                  </TooltipComponent>
                </strong>
                <small>Locks the document, then use the <strong>View as</strong> switcher to preview each role's access.</small>
              </span>
            </div>
            <div className={`claw-feature-state${commentsEnabled || restrictionsEnabled ? "" : " off"}`} id="featureState">
              <span className="dot" />
              <span>{commentsEnabled || restrictionsEnabled ? "Demo features enabled" : "Demo features disabled"}</span>
            </div>
          </div>

          {restrictionsEnabled ? (
            <div className="claw-restriction-strip" aria-label="Active reviewer restrictions">
              {buildRestrictions(contract.data!).map((r) => (
                <LabelChip key={r} text={r} />
              ))}
            </div>
          ) : null}

          <div className="claw-workspace-toolbar">
            <div className="claw-toolbar-group">
              <LabelChip text={previewWithData ? "Preview with data" : "Draft"} cssClass="e-info" />
            </div>
            <div className="claw-toolbar-group">
              <label htmlFor="role-switcher" className="muted" style={{ fontSize: 12 }}>
                View as
              </label>
              <div className="claw-role-switcher">
                <ComboBoxComponent
                  id="role-switcher"
                  width="160px"
                  dataSource={ROLE_IDS}
                  value={currentRole}
                  change={(args) => args.value && setCurrentRole(args.value as Role)}
                  aria-label="View as role"
                />
              </div>
            </div>
          </div>

          <div className="claw-editor-layout">
            <div className="claw-editor-pane">
              <div
                className="claw-editor-loading"
                hidden={editorReady}
                aria-hidden={editorReady}
                aria-live="polite"
                aria-busy={!editorReady}
              >
                <SkeletonComponent width="40%" height="16px" style={{ marginBottom: 12 }} />
                <SkeletonComponent width="100%" height="560px" />
              </div>
              <div className="claw-editor-ej2">
                <div className="claw-editor-host">
                  {editorMounted ? (
                    <DocumentEditorIsland
                      editorRef={containerRef}
                      serviceUrl={editorServiceUrl}
                      onCreated={handleEditorCreated}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <aside className="claw-side-panel" aria-label="Editor side panel">
              <SidePanelTabs active={tab} onChange={setTab} />

              {tab === "merge" ? (
                <MergeFieldsPanel
                  contract={contract.data!}
                  previewWithData={previewWithData}
                  onPreview={handlePreviewWithData}
                  onReplaceToken={replaceToken}
                />
              ) : null}
              {tab === "clauses" ? (
                <ClauseLibraryPanel
                  clauses={clauses.data ?? []}
                  loading={clauses.loading}
                  documentSlots={documentSlots}
                  insertedClauses={insertedClauses}
                  onInsert={handleInsertClause}
                />
              ) : null}
              {tab === "assignments" ? (
                <AssignmentsPanel
                  contract={contract.data!}
                  reviewers={reviewers.data ?? []}
                  loading={reviewers.loading}
                  documentSlots={documentSlots}
                  onAssign={handleAssign}
                />
              ) : null}
            </aside>
          </div>
        </div>
        </EditorErrorBoundary>
      )}
      {contract.data && catalogEntry ? (
        <MockDataDialog
          open={mockDialogOpen}
          templateName={catalogEntry.name}
          fieldKeys={catalogEntry.fieldKeys}
          onApply={(values, datasetName) => applyMockMergeData(values, datasetName)}
          onCancel={() => setMockDialogOpen(false)}
        />
      ) : null}
    </section>
  );
}

const DocumentEditorIsland = memo(
  function DocumentEditorIsland({
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
        id="claw-doc-editor"
        ref={editorRef}
        height="610px"
        created={onCreated}
        serviceUrl={serviceUrl}
        enableToolbar
        toolbarMode="Ribbon"
        ribbonLayout="Simplified"
        showPropertiesPane={false}
        currentUser="Maya Chen"
        documentEditorSettings={{ highlightEditableRanges: true }}
        enableComment={false}
      />
    );
  },
  () => true
);

class EditorErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Editor workspace failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <StateMessage severity="Error" title="Editor failed to load">
          <p>The document editor could not be mounted. Go back to the dashboard and open the contract again.</p>
        </StateMessage>
      );
    }
    return this.props.children;
  }
}

function SidePanelTabs({
  active,
  onChange,
}: {
  active: SideTab;
  onChange: (tab: SideTab) => void;
}) {
  const selectedItem = Math.max(0, SIDE_TABS.findIndex((item) => item.id === active));

  const handleSelected = useCallback(
    (args: SelectEventArgs) => {
      const next = SIDE_TABS[args.selectedIndex];
      if (next && next.id !== active) onChange(next.id);
    },
    [active, onChange]
  );

  return (
    <TabComponent
      cssClass="claw-side-tabs"
      width="100%"
      selectedItem={selectedItem}
      selected={handleSelected}
      overflowMode="Popup"
      showCloseButton={false}
      swipeMode="None"
      heightAdjustMode="None"
      animation={{ previous: { effect: "None" }, next: { effect: "None" } }}
    >
      <TabItemsDirective>
        {SIDE_TABS.map((item) => (
          <TabItemDirective key={item.id} header={{ text: item.text }} content="" />
        ))}
      </TabItemsDirective>
    </TabComponent>
  );
}

function MergeFieldsPanel({
  contract,
  previewWithData,
  onPreview,
  onReplaceToken,
}: {
  contract: ContractDetail;
  previewWithData: boolean;
  onPreview: () => void;
  onReplaceToken: (token: string, value: string) => void;
}) {
  const [template, setTemplate] = useState<{ mergeFieldTokens: string[] } | null>(null);
  const [unmapped, setUnmapped] = useState<string[]>([]);

  useEffect(() => {
    contractService.getTemplate(contract.templateId).then((t) => {
      setTemplate(t);
      contractService.getAccount(contract.accountId).then((a) => {
        setUnmapped(t.mergeFieldTokens.filter((tok) => !(tok in a.mergeValues)));
      });
    });
  }, [contract.templateId, contract.accountId]);

  void previewWithData;

  return (
    <div>
      <StateMessage severity="Info" title="Merge fields">
        <p>Populate merge fields with a mock CRM dataset via &quot;Preview with data&quot;, or replace a single field below.</p>
      </StateMessage>
      <ButtonComponent
        cssClass="claw-button primary"
        isPrimary
        type="button"
        onClick={onPreview}
        style={{ width: "100%", marginBottom: 14 }}
      >
        Preview with data
      </ButtonComponent>
      {template ? (
        template.mergeFieldTokens.map((token) => (
          <div key={token} className="claw-field">
            <span>{humanizeToken(token)}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <code>«{token}»</code>
              <ButtonComponent
                cssClass="claw-button"
                type="button"
                onClick={() => {
                  contractService.getAccount(contract.accountId).then((a) => {
                    if (token in a.mergeValues) onReplaceToken(token, a.mergeValues[token]);
                  });
                }}
              >
                Replace
              </ButtonComponent>
            </div>
          </div>
        ))
      ) : null}
      {unmapped.length > 0 ? (
        <StateMessage severity="Warning" title="Unmapped tokens" cssClass="claw-unmapped-callout">
          <p>Unmapped optional token(s): {unmapped.join(", ")}</p>
        </StateMessage>
      ) : null}
    </div>
  );
}

function ClauseLibraryPanel({
  clauses,
  loading,
  documentSlots,
  insertedClauses,
  onInsert,
}: {
  clauses: Clause[];
  loading: boolean;
  documentSlots: { id: string; label: string }[];
  insertedClauses: { clauseId: string; name: string; risk: string; slot: string }[];
  onInsert: (clause: Clause, slot: string) => void;
}) {
  const slotOptions = documentSlots.length > 0 ? documentSlots : FALLBACK_SLOTS;
  const [selectedSlot, setSelectedSlot] = useState<string>(slotOptions[0]?.id ?? "sec_general");
  const [selectedClauseId, setSelectedClauseId] = useState<string>("");

  const treeData = useMemo(() => groupByCategory(clauses), [clauses]);

  if (loading) {
    return (
      <div aria-hidden="true">
        <SkeletonComponent width="90%" height="16px" style={{ marginBottom: 8 }} />
        <SkeletonComponent width="70%" height="16px" style={{ marginBottom: 8 }} />
        <SkeletonComponent width="80%" height="16px" />
      </div>
    );
  }

  const selectedClause = clauses.find((c) => c.id === selectedClauseId) ?? clauses[0];

  return (
    <div className="claw-clause-library">
      <StateMessage severity="Info" title="Clause library">
        <p>Select a clause from the list, pick a clause slot, then click insert to add it at that bookmark.</p>
      </StateMessage>
      <label htmlFor="clause-slot" className="claw-eyebrow" style={{ display: "block", marginBottom: 6 }}>
        Target clause slot
      </label>
      <DropDownListComponent
        id="clause-slot"
        cssClass="claw-form-dropdown"
        dataSource={slotOptions}
        fields={{ text: "label", value: "id" }}
        value={selectedSlot}
        change={(e) => {
          if (e.value) setSelectedSlot(String(e.value));
        }}
        placeholder="Select a clause slot"
      />

      <TreeViewComponent
        id="clause-tree"
        cssClass="claw-clause-tree"
        fields={{ id: "id", text: "name", child: "children", dataSource: treeData as unknown as Record<string, object>[] }}
        allowMultiSelection={false}
        nodeSelected={(args: unknown) => {
          // TreeView parents group clauses by category; selecting the category
          // itself just syncs the ListView to its first clause.
          const node = args as { nodeData?: { id?: string } };
          const id = node?.nodeData?.id;
          if (typeof id === "string") {
            const clauseInCategory = clauses.find((c) => c.id === id);
            if (clauseInCategory) setSelectedClauseId(clauseInCategory.id);
          }
        }}
      />
      <div className="claw-eyebrow" style={{ margin: "14px 0 8px" }}>All clauses</div>
      <ListViewComponent
        id="clause-list"
        cssClass="claw-clause-list"
        dataSource={clauses as unknown as Record<string, object>[]}
        fields={{ text: "name", id: "id" }}
        aria-label="Clause library list"
        select={(args: unknown) => {
          const item = args as { text?: string; data?: { id?: string } };
          if (item?.data?.id) setSelectedClauseId(item.data.id);
        }}
      />
      <div className="claw-eyebrow" style={{ margin: "16px 0 8px" }}>Inserted clauses</div>
      {insertedClauses.length > 0 ? (
        insertedClauses.map((c) => (
          <div key={`${c.clauseId}-${c.slot}`} className="claw-field">
            <span>{c.name}</span>
            <RiskChip risk={c.risk as "Low" | "Standard" | "ReviewNeeded"} />
          </div>
        ))
      ) : (
        <div className="muted" style={{ fontSize: 12 }}>No clauses inserted yet in this session.</div>
      )}
      <ButtonComponent
        cssClass="claw-button primary"
        isPrimary
        type="button"
        disabled={!selectedClause}
        onClick={() => {
          if (selectedClause) onInsert(selectedClause, selectedSlot);
        }}
        style={{ width: "100%", marginTop: 14 }}
      >
        Insert selected clause
      </ButtonComponent>
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {selectedClause
          ? `Selected: ${selectedClause.name}`
          : "Click a clause in the list to select it."}
      </div>
    </div>
  );
}

function AssignmentsPanel({
  contract,
  reviewers,
  loading,
  documentSlots,
  onAssign,
}: {
  contract: ContractDetail;
  reviewers: Reviewer[];
  loading: boolean;
  documentSlots: { id: string; label: string }[];
  onAssign: (section: string, reviewerId: string, level: "ReadOnly" | "CommentsOnly") => void;
}) {
  // Prefer the document's real clause-slot bookmarks — assigning one of these
  // produces a working editable region. Fall back to seeded assignments (then a
  // static list) before the document's bookmarks are known.
  const sections = documentSlots.length > 0
    ? documentSlots.map((s) => s.id)
    : contract.assignments.length > 0
      ? Array.from(new Set(contract.assignments.map((a) => a.sectionBookmark)))
      : ["sec_fees", "sec_liability", "sec_termination"];

  const [reviewerBySection, setReviewerBySection] = useState<Record<string, string>>({});
  const [levelBySection, setLevelBySection] = useState<Record<string, "ReadOnly" | "CommentsOnly">>({});

  if (loading) {
    return <SkeletonComponent width="90%" height="80px" />;
  }

  return (
    <div>
      <StateMessage severity="Info" title="Editing restrictions">
        <p>
          Assigning a section with <strong>Comments only</strong> turns its document bookmark into an
          editable region for that reviewer's role; everything else stays locked. Enable{" "}
          <strong>Apply section editing restrictions</strong> above, then switch <strong>View as</strong> to
          preview each role's access. The sections below are the real slots in this document.
        </p>
      </StateMessage>
      {sections.map((section) => (
        <div key={section} className="claw-clause-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 12 }}>{humanizeSection(section)}</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <DropDownListComponent
              cssClass="claw-form-dropdown"
              dataSource={reviewers.map((r) => ({ id: r.id, label: `${r.name} — ${r.role}` }))}
              fields={{ text: "label", value: "id" }}
              placeholder="Select reviewer…"
              value={reviewerBySection[section] || null}
              change={(e) => {
                if (e.value) setReviewerBySection((prev) => ({ ...prev, [section]: String(e.value) }));
              }}
              htmlAttributes={{ "aria-label": `Reviewer for ${section}` }}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <DropDownListComponent
              cssClass="claw-form-dropdown"
              dataSource={[
                { id: "CommentsOnly", label: "Comments only" },
                { id: "ReadOnly", label: "Read-only" },
              ]}
              fields={{ text: "label", value: "id" }}
              value={levelBySection[section] ?? "CommentsOnly"}
              change={(e) => {
                if (e.value === "ReadOnly" || e.value === "CommentsOnly") {
                  setLevelBySection((prev) => ({ ...prev, [section]: e.value }));
                }
              }}
              htmlAttributes={{ "aria-label": `Protection for ${section}` }}
              style={{ flex: 1, marginBottom: 0 }}
            />
          </div>
          <ButtonComponent
            cssClass="claw-button"
            type="button"
            onClick={() => {
              if (reviewerBySection[section]) {
                onAssign(section, reviewerBySection[section], levelBySection[section] ?? "CommentsOnly");
              } else {
                showToast("Select a reviewer before assigning.", "Editing restrictions");
              }
            }}
            style={{ width: "100%", fontSize: 11 }}
          >
            Assign section
          </ButtonComponent>
        </div>
      ))}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true">
      <SkeletonComponent width="40%" height="28px" style={{ marginBottom: 10 }} />
      <SkeletonComponent width="70%" height="14px" style={{ marginBottom: 24 }} />
      <div className="claw-feature-controls" aria-hidden="true">
        <SkeletonComponent width="80%" height="30px" />
        <SkeletonComponent width="80%" height="30px" />
        <SkeletonComponent width="40%" height="22px" />
      </div>
      <SkeletonComponent width="100%" height="610px" style={{ marginTop: 14 }} />
    </div>
  );
}

function ContractNotFound({ onBack }: { onBack: () => void }) {
  return (
    <StateMessage
      severity="Error"
      title="Contract not found"
      action={
        <ButtonComponent cssClass="claw-button" type="button" onClick={onBack}>
          Back to dashboard
        </ButtonComponent>
      }
    >
      <p>The selected contract could not be loaded. It may have been removed or the link is invalid.</p>
    </StateMessage>
  );
}

function buildRestrictions(contract: ContractDetail): string[] {
  return contract.assignments.map((a) => {
    const protection = a.protectionLevel === "CommentsOnly" ? "Comments only" : a.protectionLevel === "ReadOnly" ? "Read-only" : "Editable range";
    return `${a.reviewerRole} · ${protection}`;
  });
}

function groupByCategory(clauses: Clause[]): { id: string; name: string; children: { id: string; name: string }[] }[] {
  return Object.values(
    clauses.reduce<Record<string, { id: string; name: string; children: { id: string; name: string }[] }>>(
      (acc, c) => {
        const key = c.category;
        if (!acc[key]) acc[key] = { id: key, name: key, children: [] };
        acc[key].children.push({ id: c.id, name: c.name });
        return acc;
      },
      {}
    )
  );
}

function humanizeToken(token: string): string {
  return token.replace(/[«»{}]/g, "").replace(/([A-Z])/g, " $1").trim();
}

function humanizeSection(section: string): string {
  const map: Record<string, string> = {
    sec_confidentiality: "Confidentiality",
    sec_exclusions: "Exclusions",
    sec_fees: "Fees & payment",
    sec_term: "Term",
    sec_jurisdiction: "Jurisdiction",
    sec_termination: "Termination",
    sec_liability: "Liability",
    sec_general: "General",
    sec_data_protection: "Data protection",
    sec_delivery: "Delivery",
    sec_warranty: "Warranty",
  };
  return map[section] ?? section.replace(/^sec_/, "").replace(/_/g, " ");
}

/**
 * Opens the mapped template's real `.docx` by streaming it through the backend
 * `POST /api/documenteditor/Import` endpoint into SFDT, then `editor.open(sfdt)`.
 * No synthetic fallback — the service-down panel shows if the import fails.
 */
async function loadContractIntoEditor(
  container: DocumentEditorContainerType,
  entry: TemplateCatalogEntry,
  callbacks: { onReady: () => void; onServiceDown: () => void }
): Promise<void> {
  const editor = container.documentEditor;
  try {
    const sfdt = await importTemplateAsSfdt(entry.docxUrl);
    editor.open(sfdt);
    callbacks.onReady();
  } catch {
    callbacks.onServiceDown();
  }
}

/** Apply Calibri as the editor default and restyle the opened document. */
function applyCalibriDefault(
  editor: DocumentEditorContainerType["documentEditor"]
): void {
  editor.setDefaultCharacterFormat({ fontFamily: DEFAULT_FONT_FAMILY, fontSize: 11 });
  withTrackChangesSuspended(editor, () => {
    try {
      editor.selection.selectAll();
      editor.selection.characterFormat.fontFamily = DEFAULT_FONT_FAMILY;
      editor.selection.moveToDocumentStart();
    } catch {
      // Empty or still-layouting document — default format still applies to new text.
    }
  });
}

/**
 * Attach a dated review comment to content already in the opened document
 * (title bookmark when present, otherwise the first paragraph).
 */
function insertDemoCommentOnOpenDocument(
  editor: DocumentEditorContainerType["documentEditor"],
  author: string
): boolean {
  try {
    withTrackChangesSuspended(editor, () => {
      const bookmarks = safeGetBookmarks(editor);
      const title = bookmarks.find((name) => name.startsWith("Title_"));
      if (title) {
        editor.selection.selectBookmark(title);
      } else {
        editor.selection.moveToDocumentStart();
        editor.selection.selectParagraph();
      }
      editor.editor.insertComment(DEMO_COMMENT_TEXT, {
        author,
        dateTime: new Date(),
        isResolved: false,
      });
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Template `.docx` slot names (authored by the backend
 * `ContractWorkspace.TemplateGenerator` via `AddClauseSlot`) → semantic
 * side-panel slot ids. Each slot emits two bookmarks — `Slot_Xy` around the
 * bold label and `SlotBody_Slot_Xy` around the "[Insert … Clause: …]"
 * placeholder paragraph that an insertion replaces:
 *   Mutual NDA        → Confidentiality, Exclusions, Term
 *   Service Agreement → Payment, Liability, Termination
 *   Purchase Contract → Delivery, Warranty, DataProtection
 */
const SLOT_BY_TEMPLATE_NAME: Record<string, string> = {
  Confidentiality: "sec_confidentiality",
  Exclusions: "sec_exclusions",
  Term: "sec_term",
  Payment: "sec_fees",
  Liability: "sec_liability",
  Termination: "sec_termination",
  Delivery: "sec_delivery",
  Warranty: "sec_warranty",
  DataProtection: "sec_data_protection",
};

const SLOT_BODY_PREFIX = "SlotBody_Slot_";

/** Slot options shown before the document's real bookmarks are known. */
const FALLBACK_SLOTS: { id: string; label: string }[] = [
  { id: "sec_confidentiality", label: "Confidentiality" },
  { id: "sec_liability", label: "Liability" },
  { id: "sec_fees", label: "Fees & payment" },
  { id: "sec_termination", label: "Termination" },
  { id: "sec_data_protection", label: "Data protection" },
];

/** Derive the side-panel slot options from the loaded document's bookmarks. */
function resolveDocumentSlots(bookmarks: string[]): { id: string; label: string }[] {
  return bookmarks
    .filter((name) => name.startsWith(SLOT_BODY_PREFIX))
    .map((name) => SLOT_BY_TEMPLATE_NAME[name.slice(SLOT_BODY_PREFIX.length)])
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, label: humanizeSection(id) }));
}

/**
 * Insert clause text into a named slot: select the slot's body bookmark (the
 * placeholder paragraph authored into the template) and insert over that
 * selection, so the clause replaces the placeholder in place. Falls back to
 * caret insertion when the document has no matching bookmark. Returns true
 * when the text landed in the slot itself.
 */
function insertClauseAtSlot(
  editor: DocumentEditorContainerType["documentEditor"],
  slot: string,
  body: string
): boolean {
  const target = findSlotBodyBookmark(editor, slot);
  withTrackChangesSuspended(editor, () => {
    if (target) editor.selection.selectBookmark(target);
    editor.editor.insertText(body);
  });
  return target !== null;
}

/**
 * Turn an assigned section into a Syncfusion editable region owned by `user`
 * (the reviewer's role, matched against `container.currentUser`). Resolves the
 * section id to its real `SlotBody_Slot_*` bookmark, selects it, and marks it
 * editable. Returns true when a region landed; false when the template has no
 * matching bookmark. Must run while document protection is stopped.
 */
function applyEditableRegionForAssignment(
  editor: DocumentEditorContainerType["documentEditor"],
  secId: string,
  user: string
): boolean {
  const bookmark = findSlotBodyBookmark(editor, secId);
  if (!bookmark) return false;
  withTrackChangesSuspended(editor, () => {
    editor.selection.selectBookmark(bookmark);
    editor.editor.insertEditingRegion(user);
  });
  return true;
}

/**
 * Apply the per-section protection model: unlock the document, insert an
 * editable region for every "Comments only" assignment (keyed to its reviewer's
 * role), then enforce global ReadOnly so everything else is locked. The
 * `applied` set guards against inserting a region twice across effect re-runs —
 * regions persist in the document, so we only insert new signatures and simply
 * re-enforce the lock otherwise. "Read-only" assignments are intentionally
 * skipped (their section stays locked for everyone).
 */
function applyAllRestrictions(
  editor: DocumentEditorContainerType["documentEditor"],
  assignments: ReviewAssignment[],
  reviewers: Reviewer[],
  applied: Set<string>
): void {
  try {
    editor.editor.stopProtection("claw-demo");
  } catch {
    // Not currently protected — inserting regions below is safe.
  }
  editor.isReadOnly = false;
  for (const a of assignments) {
    if (a.protectionLevel !== "CommentsOnly") continue;
    const reviewer = reviewers.find((r) => r.id === a.reviewerId);
    const user = reviewer?.role ?? a.reviewerRole;
    const signature = `${a.sectionBookmark}::${user}`;
    if (applied.has(signature)) continue;
    if (applyEditableRegionForAssignment(editor, a.sectionBookmark, user)) {
      applied.add(signature);
    }
  }
  editor.editor.enforceProtection("claw-demo", "ReadOnly");
}

/** Find the slot-body bookmark for a semantic slot id, or null when absent. */
function findSlotBodyBookmark(
  editor: DocumentEditorContainerType["documentEditor"],
  slot: string
): string | null {
  for (const name of safeGetBookmarks(editor)) {
    if (!name.startsWith(SLOT_BODY_PREFIX)) continue;
    if (SLOT_BY_TEMPLATE_NAME[name.slice(SLOT_BODY_PREFIX.length)] === slot) return name;
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
