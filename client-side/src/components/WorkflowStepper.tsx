import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  StepperComponent,
  type StepModel,
  type StepperChangedEventArgs,
  type StepperChangingEventArgs,
} from "@syncfusion/ej2-react-navigations";
import {
  WORKFLOW_STEPS,
  activeStepFromPath,
  contractIdFromPath,
  pathForWorkflowStep,
} from "./workflowSteps";

interface WorkflowStepperProps {
  sidebarOpen: boolean;
  onNavigated?: () => void;
}

export default function WorkflowStepper({ sidebarOpen, onNavigated }: WorkflowStepperProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const stepperRef = useRef<StepperComponent>(null);

  const activeStep = activeStepFromPath(pathname);
  const contractId = contractIdFromPath(pathname);

  const steps: StepModel[] = useMemo(
    () =>
      WORKFLOW_STEPS.map((step, index) => ({
        text: step.text,
        label: step.label,
        iconCss: step.iconCss,
        status: index < activeStep ? "Completed" : index === activeStep ? "InProgress" : "NotStarted",
        disabled: index > activeStep,
      })),
    [activeStep]
  );

  const handleStepChanging = useCallback(
    (args: StepperChangingEventArgs) => {
      if (!args.isInteracted) return;
      if (args.activeStep > args.previousStep) {
        args.cancel = true;
        return;
      }
      if (args.activeStep > 0 && !contractId) {
        args.cancel = true;
      }
    },
    [contractId]
  );

  const handleStepChanged = useCallback(
    (args: StepperChangedEventArgs) => {
      if (!args.isInteracted) return;
      const to = pathForWorkflowStep(args.activeStep, contractId);
      if (!to || to === pathname) return;
      void navigate(to);
      onNavigated?.();
    },
    [contractId, navigate, onNavigated, pathname]
  );

  useEffect(() => {
    const refresh = () => stepperRef.current?.refreshProgressbar();
    const timer = window.setTimeout(refresh, 350);
    window.addEventListener("resize", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refresh);
    };
  }, [sidebarOpen]);

  return (
    <nav className="claw-workflow-nav" aria-label="Workflow">
      <StepperComponent
        ref={stepperRef}
        steps={steps}
        activeStep={activeStep}
        linear
        orientation="vertical"
        stepType={sidebarOpen ? "Default" : "Indicator"}
        labelPosition="End"
        cssClass="claw-workflow-stepper"
        showTooltip={!sidebarOpen}
        animation={{ enable: true, duration: 400, delay: 0 }}
        stepChanging={handleStepChanging}
        stepChanged={handleStepChanged}
      />
    </nav>
  );
}
