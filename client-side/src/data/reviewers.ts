/**
 * Deterministic seed data — Reviewer directory (Legal / Finance / Customer / Author).
 *
 * 100% synthetic personas — no PII.
 */

import type { Reviewer } from "../models";

export const reviewersSeed: Reviewer[] = [
  { id: "rvw-maya", name: "Maya Chen", role: "Author" },
  { id: "rvw-priya-legal", name: "Priya Raman", role: "Legal" },
  { id: "rvw-david-legal", name: "David Okafor", role: "Legal" },
  { id: "rvw-omar-finance", name: "Omar Farouk", role: "Finance" },
  { id: "rvw-nadia-finance", name: "Nadia Petrov", role: "Finance" },
  { id: "rvw-elena-customer", name: "Elena Rossi", role: "Customer" },
  { id: "rvw-jordan-customer", name: "Jordan Lee", role: "Customer" },
];
