# Contract Lifecycle & Approval Workspace

Draft, review, sign, and publish contracts from reusable Word templates in one workspace — a Syncfusion React showcase.


| App | Folder | Stack |
|-----|--------|-------|
| **Frontend** | [`client-side/`](client-side/) | React 19 + Vite + Syncfusion Document Editor & PDF Viewer |
| **Backend** | [`server-side/`](server-side/) | ASP.NET Core Document Editor service (Word import, mail merge, comparison, PDF/DOCX export) |

Start the **backend first** — the frontend depends on it for import, merge, comparison, and export.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) ≥ 20 and npm ≥ 10
- A Syncfusion license key (optional — apps run in trial mode without one)

## 1. Run the backend

```bash
cd server-side
dotnet restore
dotnet run --project src/ContractWorkspace.DocumentService/ContractWorkspace.DocumentService.csproj
```

The service runs at **http://localhost:5212** (health check: `GET /health`).

> First run: generate the template DOCX files if `wwwroot/Templates/` is empty:
> ```bash
> dotnet run --project src/ContractWorkspace.TemplateGenerator/ContractWorkspace.TemplateGenerator.csproj
> ```

## 2. Run the frontend

In a new terminal:

```bash
cd client-side
cp .env.example .env      # then set the values below
npm install
npm run dev
```

The app runs at **http://localhost:5173**.

Set these in `client-side/.env`:

| Variable | Value |
|----------|-------|
| `VITE_DOCUMENT_EDITOR_SERVICE_URL` | `http://localhost:5212` |
| `VITE_SYNCFUSION_LICENSE_KEY` | Your license key (leave empty for trial mode) |

## More detail

- Frontend: [`client-side/README.md`](client-side/README.md)
- Backend: [`server-side/README.md`](server-side/README.md)

## Legal disclaimer

All templates, clauses, and data are synthetic fictional content for demonstration only — no real contract text and no PII. Signatures are image-based approval signatures, **not** certificate-backed digital signatures.
