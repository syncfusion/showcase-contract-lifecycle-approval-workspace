/**
 * Mock contract service — session-scoped, in-memory state backed by deterministic
 * seeds. Promise-based with simulated latency (200–600 ms). API-shaped so a real
 * backend can replace it later without UI rewrites.
 *
 * Writes are session-scoped only and reset on reload. Hosted demo is
 * read-only at the business-data layer: writes remain available locally but
 * are labeled ephemeral.
 */

import type {
  AccountDetail,
  ActivityLogEntry,
  AppError,
  Clause,
  ClauseInsertResult,
  ContractDetail,
  ContractTemplate,
  ReviewAssignment,
  Reviewer,
  SignatureRecord,
  VersionSnapshot,
  VersionSummary,
} from "../models";

import {
  templatesSeed,
  accountsSeed,
  clausesSeed,
  reviewersSeed,
  contractsSeed,
  versionsSeed,
  assignmentsSeed,
  activitySeed,
  signaturesSeed,
} from "../data";

// --- Simulated latency helper ---

function delay<T>(value: T, ms = 200 + Math.floor(Math.random() * 400)): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function appError(code: string, message: string, retryable = false): AppError {
  return { code, message, retryable };
}

function rejectError(code: string, message: string, retryable = false): Promise<never> {
  return Promise.reject(appError(code, message, retryable));
}

// --- Session-scoped in-memory store (deep clone of seeds) ---

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const sessionContracts: ContractDetail[] = clone(contractsSeed);
const sessionVersions: VersionSnapshot[] = clone(versionsSeed);
const sessionAssignments: ReviewAssignment[] = clone(assignmentsSeed);
const sessionActivity: ActivityLogEntry[] = clone(activitySeed);
const sessionSignatures: SignatureRecord[] = clone(signaturesSeed);

// --- In-memory index helpers ---

function contractById(id: string): ContractDetail | undefined {
  return sessionContracts.find((c) => c.id === id);
}
function templateById(id: string): ContractTemplate | undefined {
  return templatesSeed.find((t) => t.id === id);
}
function accountById(id: string): AccountDetail | undefined {
  return accountsSeed.find((a) => a.id === id);
}
function reviewerById(id: string): Reviewer | undefined {
  return reviewersSeed.find((r) => r.id === id);
}
function clauseById(id: string): Clause | undefined {
  return clausesSeed.find((c) => c.id === id);
}

// --- Filter types ---

export interface ClauseFilter {
  category?: Clause["category"];
  riskLevel?: Clause["riskLevel"];
}

// --- Service surface ---

export const contractService = {
  async getTemplate(id: string): Promise<ContractTemplate> {
    const template = templateById(id);
    if (!template) return rejectError("NOT_FOUND", `Template ${id} not found`);
    return delay(clone(template));
  },

  async getContract(id: string): Promise<ContractDetail> {
    const contract = contractById(id);
    if (!contract) return rejectError("NOT_FOUND", `Contract ${id} not found`);
    const detail = clone({
      ...contract,
      versions: sessionVersions.filter((v) => v.contractId === id),
      assignments: sessionAssignments.filter((a) => a.contractId === id),
      activity: sessionActivity.filter((a) => a.contractId === id),
    });
    return delay(detail);
  },

  async getAccount(id: string): Promise<AccountDetail> {
    const account = accountById(id);
    if (!account) return rejectError("NOT_FOUND", `Account ${id} not found`);
    return delay(clone(account));
  },

  async getClauses(filter?: ClauseFilter): Promise<Clause[]> {
    let rows = clone(clausesSeed);
    if (filter) {
      if (filter.category) rows = rows.filter((c) => c.category === filter.category);
      if (filter.riskLevel) rows = rows.filter((c) => c.riskLevel === filter.riskLevel);
    }
    return delay(rows);
  },

  async getReviewers(): Promise<Reviewer[]> {
    return delay(clone(reviewersSeed));
  },

  async getVersions(contractId: string): Promise<VersionSummary[]> {
    const rows = sessionVersions
      .filter((v) => v.contractId === contractId)
      .sort((a, b) => b.versionNo - a.versionNo);
    return delay(clone(rows));
  },

  async insertClause(req: {
    contractId: string;
    clauseId: string;
    slot: string;
  }): Promise<ClauseInsertResult> {
    const contract = contractById(req.contractId);
    if (!contract) return rejectError("NOT_FOUND", `Contract ${req.contractId} not found`);
    const clause = clauseById(req.clauseId);
    if (!clause) return rejectError("NOT_FOUND", `Clause ${req.clauseId} not found`);
    const nowIso = new Date().toISOString();
    sessionActivity.push({
      id: `act-${contract.id}-clause-${Date.now().toString(36)}`,
      contractId: contract.id,
      type: "ClauseInserted",
      actor: "Maya Chen",
      timestamp: nowIso,
      detail: `Inserted ${clause.name} at ${req.slot}`,
    });
    contract.updatedDate = nowIso;
    const result: ClauseInsertResult = {
      contractId: contract.id,
      clauseId: clause.id,
      insertedAtBookmark: req.slot,
      insertedClauseName: clause.name,
      riskLevel: clause.riskLevel,
    };
    return delay(result, 350);
  },

  async assignSection(req: {
    contractId: string;
    sectionId: string;
    reviewerId: string;
    protectionLevel: ReviewAssignment["protectionLevel"];
  }): Promise<ReviewAssignment> {
    const contract = contractById(req.contractId);
    if (!contract) return rejectError("NOT_FOUND", `Contract ${req.contractId} not found`);
    const reviewer = reviewerById(req.reviewerId);
    if (!reviewer) return rejectError("VALIDATION", "Reviewer is required.");
    const existing = sessionAssignments.find(
      (a) => a.contractId === req.contractId && a.sectionBookmark === req.sectionId
    );
    if (existing) {
      return rejectError("VALIDATION", "A reviewer is already assigned to this section.");
    }
    const nowIso = new Date().toISOString();
    const assignment: ReviewAssignment = {
      id: `asg-${Date.now().toString(36)}`,
      contractId: contract.id,
      sectionName: req.sectionId.replace(/^sec_/, "").replace(/_/g, " "),
      sectionBookmark: req.sectionId,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      reviewerRole: reviewer.role,
      protectionLevel: req.protectionLevel,
      status: "Pending",
      isOverdue: false,
    };
    sessionAssignments.push(assignment);
    contract.assignments = sessionAssignments.filter((a) => a.contractId === contract.id);
    sessionActivity.push({
      id: `act-${contract.id}-assign-${Date.now().toString(36)}`,
      contractId: contract.id,
      type: "Assigned",
      actor: "Maya Chen",
      timestamp: nowIso,
      detail: `Assigned ${assignment.sectionName} to ${reviewer.name} (${reviewer.role})`,
    });
    contract.updatedDate = nowIso;
    return delay(clone(assignment), 400);
  },

  async attachSignature(req: {
    contractId: string;
    signer: { name: string; title: string };
    imageData: string;
  }): Promise<SignatureRecord> {
    const contract = contractById(req.contractId);
    if (!contract) return rejectError("NOT_FOUND", `Contract ${req.contractId} not found`);
    const nowIso = new Date().toISOString();
    const record: SignatureRecord = {
      contractId: contract.id,
      signerName: req.signer.name,
      signerTitle: req.signer.title,
      signedDate: nowIso,
      imageData: req.imageData,
      disclaimer:
        "This is an image-based approval signature, not a certificate-backed digital signature.",
    };
    sessionSignatures.push(record);
    sessionActivity.push({
      id: `act-${contract.id}-sign-${Date.now().toString(36)}`,
      contractId: contract.id,
      type: "Signed",
      actor: req.signer.name,
      timestamp: nowIso,
      detail: "Image-based approval signature attached",
    });
    contract.updatedDate = nowIso;
    return delay(clone(record), 450);
  },
};
