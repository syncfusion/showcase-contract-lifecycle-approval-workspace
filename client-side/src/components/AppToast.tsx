/**
 * Syncfusion Toast container — single shared instance mounted at app root.
 * Other components call `showToast(content)` to fire a transient message.
 */

import { createRef, useCallback, useMemo, useRef } from "react";
import { ToastComponent } from "@syncfusion/ej2-react-notifications";

const toastRef = createRef<ToastComponent>();

export function showToast(
  content: string,
  title = "Contract Lifecycle",
  cssClass = "claw-toast"
): void {
  toastRef.current?.show({ title, content, cssClass });
}

export default function AppToast() {
  const createdRef = useRef(false);
  // Guard against StrictMode double-init by tracking creation.
  useCallback(() => {
    createdRef.current = true;
  }, []);

  const target = useMemo(() => document.body, []);
  return (
    <ToastComponent
      id="claw-app-toast"
      ref={toastRef}
      position={{ X: "Right", Y: "Top" }}
      target={target}
      timeOut={3500}
      showProgressBar
      newestOnTop
      animation={{ show: { effect: "SlideRightIn" }, hide: { effect: "FadeOut" } }}
    />
  );
}
