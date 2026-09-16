# Contract Lifecycle & Approval Workspace — React Frontend

React frontend for the Contract Lifecycle & Approval Workspace showcase.
Draft, review, sign, and export contracts from reusable Word templates using
Syncfusion Document Editor and PDF Viewer.

Contract records are mock and session-scoped. Word import, mail merge,
comparison, and export run against the companion ASP.NET Core Document Editor
service — see `../server-side/README.md`.

## Screens

| Screen | Route | What it does |
|---|---|---|
| Dashboard | `/` | Template gallery from the document-service catalog. Opening a card loads that template's demo contract in the editor. |
| Editor Workspace | `/editor/:contractId` | Document Editor with Ribbon: merge fields and mock-data preview, clause library, section editing restrictions, role switcher, comments, and track changes. **Compare versions** sends the edited document to Review. |
| Review & Approval | `/review/:contractId` | Side-by-side original and compared documents, version pickers, synchronized scrolling, and a revisions pane (accept/reject). |
| Sign & Publish | `/publish/:contractId` | Image-based approval signature at the signature-block bookmark, then **Preview & export** for a clean PDF preview and DOCX/PDF download. |

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- The Document Editor service running (required for import, merge, comparison, and export)

## Configuration

Copy `.env.example` to `.env` and set:

| Env var | Purpose |
|---------|---------|
| `VITE_SYNCFUSION_LICENSE_KEY` | Syncfusion license. Leave empty to run in trial mode. |
| `VITE_DOCUMENT_EDITOR_SERVICE_URL` | Document Editor service base URL. Use `http://localhost:5212` for local development. |

## Run locally

```bash
cd client-side
cp .env.example .env   # then set VITE_DOCUMENT_EDITOR_SERVICE_URL
npm install
npm run dev
```

App: `http://localhost:5173/`


## Build

```bash
npm run build
```

Output is in `dist/`. Preview a production build with `npm run preview`.

```bash
npm run lint
npm run typecheck
```

## Packages

Syncfusion React **^34.1.0**:

- `@syncfusion/ej2-react-documenteditor` — Document Editor (Editor, Review, Sign & Publish)
- `@syncfusion/ej2-react-pdfviewer` — PDF Viewer (export preview)
- `@syncfusion/ej2-react-navigations` — AppBar, Sidebar, Breadcrumb, Stepper, Tabs, TreeView
- `@syncfusion/ej2-react-popups` — Dialog, Tooltip
- `@syncfusion/ej2-react-dropdowns` — ComboBox, DropDownList
- `@syncfusion/ej2-react-inputs` — TextBox, Signature
- `@syncfusion/ej2-react-lists` — ListView
- `@syncfusion/ej2-react-buttons` — Button, CheckBox, Switch, ChipList
- `@syncfusion/ej2-react-notifications` — Toast, Skeleton, Message
- `@syncfusion/ej2-layouts` — Card styles


## Architecture

```
src/
  pages/        Dashboard, EditorWorkspace, ReviewApproval, SignPublish
  components/   AppShell, AppToast, StateMessage, StatusChip, WorkflowStepper,
                editor/MockDataDialog
  services/     contractService.ts, documentService.ts, editedDocStore.ts
  hooks/        useTheme, useAsync
  models/       Domain types
  data/         Seed data
  routes/       Lazy-loaded page routes
  styles/       Global, app-shell, page, and Syncfusion tailwind3 theme CSS
```

Edits stay in the browser session and reset on reload.

## Legal disclaimer

All data is synthetic fictional content — no PII and no real contract text.
Image-based approval signatures are **not** certificate-backed digital
signatures.
