import { ChipListComponent } from "@syncfusion/ej2-react-buttons";
import type { RiskLevel } from "../models";

const RISK_CHIPS: Record<RiskLevel, { text: string; cssClass: string }> = {
  Low: { text: "Low risk", cssClass: "e-success" },
  Standard: { text: "Standard", cssClass: "e-info" },
  ReviewNeeded: { text: "Review needed", cssClass: "e-danger" },
};

interface ChipProps {
  text: string;
  cssClass?: string;
}

function Chip({ text, cssClass = "" }: ChipProps) {
  return (
    <ChipListComponent
      cssClass={`claw-chip ${cssClass}`.trim()}
      chips={[{ text, cssClass }]}
    />
  );
}

export function RiskChip({ risk }: { risk: RiskLevel }) {
  const chip = RISK_CHIPS[risk];
  return <Chip text={chip.text} cssClass={chip.cssClass} />;
}

export function LabelChip({ text, cssClass = "" }: ChipProps) {
  return <Chip text={text} cssClass={cssClass} />;
}
