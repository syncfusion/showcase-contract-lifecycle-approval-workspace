/**
 * Domain models for the Contract Lifecycle & Approval Workspace.
 *
 * These types describe the mock service contracts used by the React UI.
 *
 * @module models
 */

// Contract lifecycle status
export type ContractStatus =
  | "Draft"
  | "InReview"
  | "PendingSignature"
  | "Published";

// Risk levels used on template cards and clause library entries
export type RiskLevel = "Low" | "Standard" | "ReviewNeeded";

// Protection levels for section assignments (editor role protection)
export type ProtectionLevel = "Editable" | "CommentsOnly" | "ReadOnly";

// Assignment review status (Review & Approval grid)
export type AssignmentStatus = "Pending" | "InReview" | "Approved" | "Rejected";

// Contract type derived from parent template
export type ContractType =
  | "MutualNDA"
  | "ServiceAgreement"
  | "PurchaseContract"
  | "MasterAgreement"
  | "StatementOfWork";

// --- Template summary (Dashboard gallery) ---

export interface TemplateSummary {
  id: string;
  name: string;
  type: ContractType;
  riskLevel: RiskLevel;
  mergeFieldCount: number;
  clauseCount: number;
  isActive: boolean;
  templateFileSlug: string; // refers to wwwroot/Templates/{slug}.docx on the service
  description?: string;
  pageCount?: number;
  popularity?: number;
}

export interface ContractTemplate extends TemplateSummary {
  mergeFieldTokens: string[];
  clauseSlotBookmarks: string[];
  logoBookmark?: string;
  signatureBlockBookmark: string;
}

// --- Template catalog entry (backend wwwroot/Templates/templates.json) ---
// Used by the Dashboard template gallery to render preview cards and by the
// Editor to load the authored .docx directly via the DocumentEditor Import endpoint.

export type TemplateType = "NDA" | "Service Agreement" | "Purchase Contract";

export interface TemplateCatalogEntry {
  id: string;
  name: string;
  type: TemplateType;
  description: string;
  fieldKeys: string[]; // bare merge-field names (no braces)
  docxUrl: string; // absolute URL to the .docx served by wwwroot/Templates
  uploadedAt: string; // ISO
  updatedAt: string; // ISO
  thumbnailUrl: string; // data: URI (SVG/PNG) preview
}

// --- Account / Contact (mock CRM data) ---

export interface Contact {
  id: string;
  accountId?: string;
  name: string;
  title: string;
  email: string;
  phone?: string;
  isSignatory: boolean;
}

export interface Account {
  id: string;
  name: string;
  industry: string;
  website?: string;
  contactCount: number;
  region?: string;
  tier?: string;
}

export interface AccountDetail extends Account {
  contacts: Contact[];
  mergeValues: Record<string, string>; // token → value mapping for merge preview
}

// --- Contract entity (Dashboard grid + detail) ---

export interface Contract {
  id: string;
  title: string;
  type: ContractType;
  templateId: string;
  accountName: string;
  ownerId: string;
  ownerName: string;
  status: ContractStatus;
  currentVersion: number;
  updatedDate: string; // ISO
  createdDate: string; // ISO
}

export interface ContractDetail extends Contract {
  accountId: string;
  signatoryContactId?: string;
  versions: VersionSummary[];
  assignments: ReviewAssignment[];
  activity: ActivityLogEntry[];
  comments: CommentRecord[];
  publishedArtifacts?: { docxUrl: string; pdfUrl: string }; // session-scoped (in-memory only)
}

// --- Review assignments ---

export interface Reviewer {
  id: string;
  name: string;
  role: string; // Legal / Finance / Customer / Author
}

export interface ReviewAssignment {
  id: string;
  contractId: string;
  sectionName: string;
  sectionBookmark: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  protectionLevel: ProtectionLevel;
  status: AssignmentStatus;
  dueDate?: string; // ISO — undefined when not yet scheduled
  isOverdue: boolean;
}

// --- Versions & comparison ---

export interface VersionSummary {
  id: string;
  contractId: string;
  versionNo: number;
  createdBy: string;
  createdDate: string; // ISO
  commentCount: number;
  revisionCount: number;
  label: string; // e.g. "Version 3 · Sep 08, 2026"
}

export interface VersionSnapshot extends VersionSummary {
  sfdt: string; // editor SFDT payload (client-side open)
  revisions: RevisionRecord[];
}

export interface RevisionRecord {
  id: string;
  author: string;
  dateTime: string; // ISO
  type: "Insertion" | "Deletion" | "FormattingChange";
  section: string;
  excerpt: string;
  isAccepted: boolean;
  isRejected: boolean;
}

// --- Comments ---

export interface CommentRecord {
  id: string;
  contractId: string;
  author: string;
  dateTime: string; // ISO
  text: string;
  resolved: boolean;
  section: string;
}

// --- Clause library ---

export type ClauseCategory =
  | "Confidentiality"
  | "Liability"
  | "Payment"
  | "Termination"
  | "Indemnification"
  | "IP"
  | "DataProtection"
  | "General";

export interface Clause {
  id: string;
  name: string;
  category: ClauseCategory;
  riskLevel: RiskLevel;
  approved: boolean;
  body: string; // template text body to insert
}

export interface ClauseInsertResult {
  contractId: string;
  clauseId: string;
  insertedAtBookmark: string;
  insertedClauseName: string;
  riskLevel: RiskLevel;
}

// --- Activity / audit trail ---

export type ActivityType =
  | "Created"
  | "Merged"
  | "ClauseInserted"
  | "CommentAdded"
  | "RevisionAccepted"
  | "RevisionRejected"
  | "Signed"
  | "Published"
  | "Assigned"
  | "Saved";

export interface ActivityLogEntry {
  id: string;
  contractId: string;
  type: ActivityType;
  actor: string;
  timestamp: string; // ISO
  detail?: string;
}

// --- Signature ---

export interface SignatureRecord {
  contractId: string;
  signerName: string;
  signerTitle: string;
  signedDate: string; // ISO
  imageData: string; // base64 PNG data URL
  disclaimer: string;
}

// --- Errors ---

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
}
