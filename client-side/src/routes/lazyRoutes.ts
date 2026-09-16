/**
 * Lazy route definitions — page components are lazy-loaded so heavy Syncfusion
 * features (Document Editor, PDF Viewer) split into separate chunks via
 * vite.config.ts manualChunks.
 */

import { lazy } from "react";

export const Dashboard = lazy(() => import("../pages/Dashboard"));
export const EditorWorkspace = lazy(() => import("../pages/EditorWorkspace"));
export const ReviewApproval = lazy(() => import("../pages/ReviewApproval"));
export const SignPublish = lazy(() => import("../pages/SignPublish"));
