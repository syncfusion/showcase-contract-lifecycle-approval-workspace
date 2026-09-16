/**
 * Deterministic seed data — Signature records (image-based approval
 * signatures for signed/published contracts).
 *
 * Image-based disclaimer is always attached.
 */

import type { SignatureRecord } from "../models";

const DISCLAIMER =
  "This is an image-based approval signature, not a certificate-backed digital signature.";

export const signaturesSeed: SignatureRecord[] = [
  {
    contractId: "ctr-fabrikam-purchase",
    signerName: "Jordan Lee",
    signerTitle: "Director of Sourcing",
    signedDate: "2026-08-25T11:00:00Z",
    imageData: "",
    disclaimer: DISCLAIMER,
  },
  {
    contractId: "ctr-northwind-purchase",
    signerName: "Priya Shah",
    signerTitle: "VP Procurement",
    signedDate: "2026-08-28T09:08:00Z",
    imageData: "",
    disclaimer: DISCLAIMER,
  },
  {
    contractId: "ctr-contoso-service",
    signerName: "Elena Rossi",
    signerTitle: "Head of Legal",
    signedDate: "2026-08-15T15:40:00Z",
    imageData: "",
    disclaimer: DISCLAIMER,
  },
  {
    contractId: "ctr-fabrikam-nda",
    signerName: "Jordan Lee",
    signerTitle: "Director of Sourcing",
    signedDate: "2026-07-22T12:12:00Z",
    imageData: "",
    disclaimer: DISCLAIMER,
  },
  {
    contractId: "ctr-adventure-service",
    signerName: "Catalina Ortiz",
    signerTitle: "VP Operations",
    signedDate: "2026-07-10T09:25:00Z",
    imageData: "",
    disclaimer: DISCLAIMER,
  },
  {
    contractId: "ctr-contoso-purchase",
    signerName: "Elena Rossi",
    signerTitle: "Head of Legal",
    signedDate: "2026-06-30T16:35:00Z",
    imageData: "",
    disclaimer: DISCLAIMER,
  },
];
