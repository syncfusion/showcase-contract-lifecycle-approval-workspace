/**
 * Deterministic seed data — Contract versions used as comparison substrate.
 *
 * Each VersionSnapshot carries an SFDT placeholder + revision records
 * (tracked changes) captured at save time. The mock compareVersions service
 * diffs these stored snapshots.
 *
 * 100% synthetic.
 */

import type { VersionSnapshot } from "../models";

/** Minimal SFDT placeholder (real SFDT is produced by the Document Editor service Import). */
function sampleSfdt(contractId: string, versionNo: number): string {
  return JSON.stringify({
    sfdtVersion: "3.0",
    sourceContract: contractId,
    version: versionNo,
    note: "Synthetic SFDT placeholder — real content loaded via Document Editor service import.",
    sections: [
      {
        blocks: [
          { type: "Paragraph", text: "SERVICE AGREEMENT", style: "Heading1" },
          { type: "Paragraph", text: `Agreement ID: ${contractId.toUpperCase()} · Version ${versionNo}` },
          { type: "Paragraph", text: "1. Services. Provider will deliver the services described in Exhibit A." },
          {
            type: "Paragraph",
            text:
              "2. Fees and payment. Customer will pay the fees set out in the applicable order form within thirty (30) days of receiving an invoice.",
          },
        ],
      },
    ],
  });
}

export const versionsSeed: VersionSnapshot[] = [
  // Northwind service agreement — 3 versions (comparison demo: v1/v2/v3)
  {
    id: "ver-northwind-1",
    contractId: "ctr-northwind-service",
    versionNo: 1,
    createdBy: "Maya Chen",
    createdDate: "2026-08-21T14:15:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 1 · Aug 21, 2026",
    sfdt: sampleSfdt("ctr-northwind-service", 1),
    revisions: [],
  },
  {
    id: "ver-northwind-2",
    contractId: "ctr-northwind-service",
    versionNo: 2,
    createdBy: "Maya Chen",
    createdDate: "2026-09-04T11:20:00Z",
    commentCount: 2,
    revisionCount: 1,
    label: "Version 2 · Sep 04, 2026",
    sfdt: sampleSfdt("ctr-northwind-service", 2),
    revisions: [
      {
        id: "rev-nw2-1",
        author: "Priya Raman",
        dateTime: "2026-09-04T11:05:00Z",
        type: "Insertion",
        section: "sec_fees",
        excerpt: "Net 45 payment terms inserted per finance review",
        isAccepted: false,
        isRejected: false,
      },
    ],
  },
  {
    id: "ver-northwind-3",
    contractId: "ctr-northwind-service",
    versionNo: 3,
    createdBy: "Maya Chen",
    createdDate: "2026-09-08T09:40:00Z",
    commentCount: 4,
    revisionCount: 3,
    label: "Version 3 · Sep 08, 2026",
    sfdt: sampleSfdt("ctr-northwind-service", 3),
    revisions: [
      {
        id: "rev-nw3-1",
        author: "Omar Farouk",
        dateTime: "2026-09-08T09:10:00Z",
        type: "Deletion",
        section: "sec_fees",
        excerpt: "Removed 'thirty (30) days' in favour of negotiated Net 45 terms",
        isAccepted: false,
        isRejected: false,
      },
      {
        id: "rev-nw3-2",
        author: "Omar Farouk",
        dateTime: "2026-09-08T09:12:00Z",
        type: "Insertion",
        section: "sec_fees",
        excerpt: "Inserted 'forty-five (45) days' for invoice payment",
        isAccepted: false,
        isRejected: false,
      },
      {
        id: "rev-nw3-3",
        author: "Priya Raman",
        dateTime: "2026-09-08T09:34:00Z",
        type: "FormattingChange",
        section: "sec_confidentiality",
        excerpt: "Bolded 'reasonable safeguards' for emphasis",
        isAccepted: false,
        isRejected: false,
      },
    ],
  },
  // Trey Research service agreement — 2 versions
  {
    id: "ver-trey-1",
    contractId: "ctr-trey-service",
    versionNo: 1,
    createdBy: "Maya Chen",
    createdDate: "2026-08-15T08:10:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 1 · Aug 15, 2026",
    sfdt: sampleSfdt("ctr-trey-service", 1),
    revisions: [],
  },
  {
    id: "ver-trey-2",
    contractId: "ctr-trey-service",
    versionNo: 2,
    createdBy: "Nadia Petrov",
    createdDate: "2026-09-06T17:40:00Z",
    commentCount: 3,
    revisionCount: 2,
    label: "Version 2 · Sep 06, 2026",
    sfdt: sampleSfdt("ctr-trey-service", 2),
    revisions: [
      {
        id: "rev-tr2-1",
        author: "Nadia Petrov",
        dateTime: "2026-09-06T17:30:00Z",
        type: "Insertion",
        section: "sec_liability",
        excerpt: "Inserted liability cap at amount paid in the preceding 12 months",
        isAccepted: false,
        isRejected: false,
      },
      {
        id: "rev-tr2-2",
        author: "Nadia Petrov",
        dateTime: "2026-09-06T17:35:00Z",
        type: "Insertion",
        section: "sec_data_protection",
        excerpt: "Inserted data protection addendum reference (high risk)",
        isAccepted: false,
        isRejected: false,
      },
    ],
  },
  // Contoso NDA — single version
  {
    id: "ver-contoso-nda-1",
    contractId: "ctr-contoso-nda",
    versionNo: 1,
    createdBy: "Maya Chen",
    createdDate: "2026-09-08T11:10:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 1 · Sep 08, 2026",
    sfdt: sampleSfdt("ctr-contoso-nda", 1),
    revisions: [],
  },
  // Adventure Works NDA — single version
  {
    id: "ver-adventure-nda-1",
    contractId: "ctr-adventure-nda",
    versionNo: 1,
    createdBy: "Maya Chen",
    createdDate: "2026-09-06T09:45:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 1 · Sep 06, 2026",
    sfdt: sampleSfdt("ctr-adventure-nda", 1),
    revisions: [],
  },
  // Acme Logistics NDA — single version
  {
    id: "ver-acme-nda-1",
    contractId: "ctr-acme-nda",
    versionNo: 1,
    createdBy: "Maya Chen",
    createdDate: "2026-09-03T14:05:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 1 · Sep 03, 2026",
    sfdt: sampleSfdt("ctr-acme-nda", 1),
    revisions: [],
  },
  // Fabrikam purchase contract — published, 4 versions
  {
    id: "ver-fabrikam-purchase-4",
    contractId: "ctr-fabrikam-purchase",
    versionNo: 4,
    createdBy: "Maya Chen",
    createdDate: "2026-09-05T13:10:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 4 · Sep 05, 2026",
    sfdt: sampleSfdt("ctr-fabrikam-purchase", 4),
    revisions: [],
  },
  // Published contracts — single most recent version snapshot
  {
    id: "ver-northwind-purchase-5",
    contractId: "ctr-northwind-purchase",
    versionNo: 5,
    createdBy: "Maya Chen",
    createdDate: "2026-08-28T09:10:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 5 · Aug 28, 2026",
    sfdt: sampleSfdt("ctr-northwind-purchase", 5),
    revisions: [],
  },
  {
    id: "ver-contoso-service-4",
    contractId: "ctr-contoso-service",
    versionNo: 4,
    createdBy: "Maya Chen",
    createdDate: "2026-08-15T15:45:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 4 · Aug 15, 2026",
    sfdt: sampleSfdt("ctr-contoso-service", 4),
    revisions: [],
  },
  {
    id: "ver-fabrikam-nda-2",
    contractId: "ctr-fabrikam-nda",
    versionNo: 2,
    createdBy: "Maya Chen",
    createdDate: "2026-07-22T12:15:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 2 · Jul 22, 2026",
    sfdt: sampleSfdt("ctr-fabrikam-nda", 2),
    revisions: [],
  },
  {
    id: "ver-adventure-service-3",
    contractId: "ctr-adventure-service",
    versionNo: 3,
    createdBy: "Maya Chen",
    createdDate: "2026-07-10T09:25:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 3 · Jul 10, 2026",
    sfdt: sampleSfdt("ctr-adventure-service", 3),
    revisions: [],
  },
  {
    id: "ver-contoso-purchase-4",
    contractId: "ctr-contoso-purchase",
    versionNo: 4,
    createdBy: "Maya Chen",
    createdDate: "2026-06-30T16:35:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 4 · Jun 30, 2026",
    sfdt: sampleSfdt("ctr-contoso-purchase", 4),
    revisions: [],
  },
  // Pending signature — Trey purchase
  {
    id: "ver-trey-purchase-3",
    contractId: "ctr-trey-purchase",
    versionNo: 3,
    createdBy: "Maya Chen",
    createdDate: "2026-09-02T14:00:00Z",
    commentCount: 0,
    revisionCount: 0,
    label: "Version 3 · Sep 02, 2026",
    sfdt: sampleSfdt("ctr-trey-purchase", 3),
    revisions: [],
  },
];
