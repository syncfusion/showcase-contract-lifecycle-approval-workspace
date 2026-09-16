/**
 * MockDataDialog — "Preview with data" dialog.
 *
 * Lists deterministic synthetic customer JSON datasets so the user can pick one
 * and apply it to the template's merge fields (Syncfusion DialogComponent + ListView). Visibility is driven
 * declaratively via the `visible` prop and the body is always rendered, so the
 * dialog keeps a stable content -> native-footer DOM order from first open
 * (a conditionally-mounted body reflowed the footer above the content on the
 * first show).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { DialogComponent, type AnimationSettingsModel } from "@syncfusion/ej2-react-popups";
import type { ButtonPropsModel } from "@syncfusion/ej2-popups";
import { ListViewComponent, type SelectEventArgs } from "@syncfusion/ej2-react-lists";
import { mockMergeDatasets, type MockMergeDataset } from "../../data/mockMergeData";

interface MockDataDialogProps {
  open: boolean;
  templateName: string;
  fieldKeys: string[];
  onApply: (values: Record<string, string>, datasetName: string) => void;
  onCancel: () => void;
}

const dialogAnimation: AnimationSettingsModel = { effect: "None" };

export default function MockDataDialog({
  open,
  templateName,
  fieldKeys,
  onApply,
  onCancel,
}: MockDataDialogProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  // The footer buttons are created imperatively by Syncfusion (native click
  // handlers), so keep the latest selection in a ref to avoid a stale closure.
  const selectedIdRef = useRef<string>("");

  // Reset selection to the first dataset each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedId(mockMergeDatasets[0]?.id ?? "");
    }
  }, [open]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selected = useMemo<MockMergeDataset | null>(
    () => mockMergeDatasets.find((d) => d.id === selectedId) ?? null,
    [selectedId]
  );

  const coverage = useMemo(() => {
    if (!selected) return { covered: 0 as number, missing: [] as string[] };
    const covered = fieldKeys.filter((k) => Boolean(selected.values[k]));
    const missing = fieldKeys.filter((k) => !Boolean(selected.values[k]));
    return { covered: covered.length, missing };
  }, [selected, fieldKeys]);

  function handleApply() {
    const current = mockMergeDatasets.find((d) => d.id === selectedIdRef.current);
    if (!current) return;
    onApply(current.values, current.name);
  }

  function handleClose() {
    onCancel();
  }

  const footerButtons: ButtonPropsModel[] = [
    { buttonModel: { content: "Cancel", cssClass: "e-flat" }, click: handleClose },
    { buttonModel: { content: "Apply", cssClass: "e-primary", isPrimary: true }, click: handleApply },
  ];

  return (
    <DialogComponent
      id="claw-mock-data-dialog"
      header={`Preview "${templateName}" with mock data`}
      showCloseIcon
      visible={open}
      isModal
      width="460px"
      target="#root"
      animationSettings={dialogAnimation}
      buttons={footerButtons}
      close={handleClose}
    >
      <div className="claw-mock-data-body">
        <p className="muted" style={{ marginTop: 0 }}>
            Choose a mock customer dataset. Its values replace every matching
            merge field in the template.
          </p>
          <ListViewComponent
            id="claw-mock-data-list"
            cssClass="claw-mock-data-list"
            dataSource={mockMergeDatasets as unknown as { [key: string]: object }[]}
            fields={{ text: "name", id: "id" }}
            template={(data: MockMergeDataset) => (
              <div>
                <div className="claw-mock-data-name">{data.name}</div>
                <div className="claw-mock-data-sub">{data.subtitle}</div>
              </div>
            )}
            select={(args: SelectEventArgs) => {
              const raw = args.data as unknown;
              const item = (Array.isArray(raw) ? raw[0] : raw) as MockMergeDataset | undefined;
              if (item?.id) setSelectedId(item.id);
            }}
          />
          {selected ? (
            <div className="claw-mock-data-preview">
              <span className="claw-eyebrow">Values to apply</span>
              <dl className="claw-mock-data-fields">
                {fieldKeys.map((k) => (
                  <div key={k}>
                    <dt>{`«${k}»`}</dt>
                    <dd>{selected.values[k] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              {coverage.missing.length > 0 ? (
                <p className="claw-mock-data-warn">
                  No values for: {coverage.missing.join(", ")}
                </p>
              ) : (
                <p className="claw-mock-data-ok">All {fieldKeys.length} merge fields covered.</p>
              )}
            </div>
          ) : null}
        </div>
    </DialogComponent>
  );
}
