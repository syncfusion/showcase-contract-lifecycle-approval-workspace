import type { ReactNode } from "react";
import { MessageComponent } from "@syncfusion/ej2-react-notifications";

type Severity = "Normal" | "Success" | "Info" | "Warning" | "Error";

interface StateMessageProps {
  severity?: Severity;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  variant?: "Text" | "Outlined" | "Filled";
  cssClass?: string;
}

/** Syncfusion Message for empty, error, warning, and info callouts. */
export function StateMessage({
  severity = "Info",
  title,
  children,
  action,
  variant = "Outlined",
  cssClass = "",
}: StateMessageProps) {
  return (
    <MessageComponent
      severity={severity}
      variant={variant}
      cssClass={`claw-state-message ${cssClass}`.trim()}
      content={() => (
        <div className="claw-state-message-body">
          <h3>{title}</h3>
          {children ? <div className="claw-state-message-copy">{children}</div> : null}
          {action ? <div className="claw-state-message-action">{action}</div> : null}
        </div>
      )}
    />
  );
}
