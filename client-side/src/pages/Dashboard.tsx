/**
 * Dashboard — Screen 1 (`/`)
 *
 * Entry point for the single linear workflow. A template gallery card click
 * opens its canonical pre-seeded demo contract directly in the editor
 * (`/editor/:contractId`).
 *
 * States: Skeleton loading, empty, error with retry.
 */

import { useNavigate } from "react-router-dom";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { ButtonComponent } from "@syncfusion/ej2-react-buttons";
import "../styles/pages.css";
import { useTemplateCatalog } from "../hooks/useAsync";
import { showToast } from "../components/AppToast";
import { LabelChip } from "../components/StatusChip";
import { StateMessage } from "../components/StateMessage";
import { CONTRACT_ID_BY_CATALOG_ID } from "../data/demoMapping";
import type { TemplateCatalogEntry } from "../models";
import type { KeyboardEvent } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const catalog = useTemplateCatalog();

  function openTemplate(entry: TemplateCatalogEntry) {
    const contractId = CONTRACT_ID_BY_CATALOG_ID[entry.id];
    if (!contractId) {
      showToast("No demo contract is mapped to this template.", "Template");
      return;
    }
    showToast(`Opening "${entry.name}"…`, "Editor workspace");
    void navigate(`/editor/${contractId}`);
  }

  return (
    <section aria-labelledby="home-title">
      <div className="claw-screen-heading">
        <div>
          <span className="claw-eyebrow">Dashboard</span>
          <h1 id="home-title">Keep every contract moving</h1>
          <p className="muted">
            Pick a template to open it in the editor.
          </p>
        </div>
      </div>

      <div className="e-card claw-panel">
        <div className="e-card-header claw-panel-heading">
          <div className="e-card-header-caption">
            <div className="e-card-header-title">Start from a template</div>
            <div className="e-card-sub-title">Reusable documents with approved clause structure.</div>
          </div>
        </div>
        <div className="e-card-content">
          {catalog.loading ? (
            <TemplateGallerySkeleton />
          ) : catalog.error ? (
            <StateMessage
              severity="Error"
              title="Templates unavailable"
              action={
                <ButtonComponent cssClass="claw-button" type="button" onClick={catalog.retry}>
                  Retry
                </ButtonComponent>
              }
            >
              <p>Something went wrong loading this section.</p>
            </StateMessage>
          ) : catalog.data && catalog.data.length > 0 ? (
            <div className="claw-three-col">
              {catalog.data.map((t) => (
                <div
                  key={t.id}
                  className="e-card claw-template-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`${t.name} — ${t.type} template`}
                  onClick={() => openTemplate(t)}
                  onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openTemplate(t);
                    }
                  }}
                >
                  <div className="e-card-image claw-template-thumb" aria-hidden="true">
                    <img src={t.thumbnailUrl} alt="" loading="lazy" />
                  </div>
                  <div className="e-card-header">
                    <div className="e-card-header-caption">
                      <LabelChip text={t.type} cssClass="e-info" />
                      <div className="e-card-header-title">{t.name}</div>
                      <div className="e-card-sub-title">{t.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StateMessage severity="Info" title="No active templates">
              <p>Import a template to begin.</p>
            </StateMessage>
          )}
        </div>
      </div>
    </section>
  );
}

function TemplateGallerySkeleton() {
  return (
    <div className="claw-three-col">
      {[0, 1, 2].map((i) => (
        <div key={i} className="e-card claw-template-card" aria-hidden="true">
          <div className="e-card-image claw-template-thumb" />
          <div className="e-card-header">
            <div className="e-card-header-caption">
              <SkeletonComponent width="40%" height="12px" style={{ marginBottom: "10px" }} />
              <SkeletonComponent width="70%" height="14px" style={{ marginBottom: "8px" }} />
              <SkeletonComponent width="90%" height="12px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
