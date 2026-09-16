import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import AppShell from "./components/AppShell";
import AppToast from "./components/AppToast";
import { useTheme } from "./hooks/useTheme";
import { Dashboard, EditorWorkspace, ReviewApproval, SignPublish } from "./routes/lazyRoutes";

function RouteFallback() {
  return (
    <div className="claw-route-fallback" role="status" aria-live="polite" aria-busy="true">
      <SkeletonComponent width="220px" height="28px" />
      <SkeletonComponent width="320px" height="14px" />
      <span>Loading workspace…</span>
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <AppShell theme={theme} onToggleTheme={toggleTheme}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/editor/:contractId" element={<EditorWorkspace />} />
            <Route path="/review/:contractId" element={<ReviewApproval />} />
            <Route path="/publish/:contractId" element={<SignPublish />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
      <AppToast />
    </>
  );
}
