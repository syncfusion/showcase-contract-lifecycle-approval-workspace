# Contract Workspace Document Service

ASP.NET Core web service for the Syncfusion React Document Editor in
the Contract Lifecycle & Approval Workspace showcase. It performs the
server-side operations the editor cannot run in the browser (Word import,
paste-with-formatting, restrict editing, spell check, mail merge, document
comparison, and PDF/DOCX export). It stores **no business data** — only the
authored template `.docx` files under `wwwroot/Templates/`.

## Prerequisites

- .NET 10 SDK (`net10.0`)
- A Syncfusion license key (optional for local evaluation; required for
  production). The service reads `SYNCFUSION_LICENSE_KEY` from the environment.
  Without a key, endpoints still run and the runtime emits a license warning.

## Packages

Syncfusion **v34.2.7**:

- `Syncfusion.EJ2.WordEditor.AspNet.Core`
- `Syncfusion.DocIO.Net.Core`
- `Syncfusion.DocIORenderer.Net.Core`
- `Syncfusion.EJ2.SpellChecker.AspNet.Core`
- `SkiaSharp.NativeAssets.Linux` 3.119.1 and `HarfBuzzSharp.NativeAssets.Linux` 8.3.1.2
  (required for Word-to-PDF on Linux; not pulled in transitively)

## Configuration

- Local URL: `http://localhost:5212` (`appsettings.Development.json` → `Kestrel`)
- The React client reads this URL from `VITE_DOCUMENT_EDITOR_SERVICE_URL`
- CORS allows any origin (demo). Restrict this before a non-local deployment.
- Optional spell check: place Hunspell `.dic` / `.aff` / `spellcheck.json` files
  under `App_Data/`. Missing dictionaries do not affect other endpoints.

## Run locally

```bash
cd server-side
dotnet restore
dotnet run --project src/ContractWorkspace.DocumentService/ContractWorkspace.DocumentService.csproj
```

The service is live at `http://localhost:5212`.

- Health: `GET /health`
- OpenAPI: `GET /openapi/v1.json`

Point the React app at this URL with `VITE_DOCUMENT_EDITOR_SERVICE_URL` in
`client-side/.env`. See `../client-side/README.md`.

## Generate template DOCX assets

`ContractWorkspace.TemplateGenerator` authors the three template documents
(Mutual NDA, Service Agreement, Purchase Contract) with Syncfusion DocIO. Each
file includes Word merge fields, section bookmarks, clause slots, and a
signature-block placeholder.

```bash
cd server-side
dotnet run --project src/ContractWorkspace.TemplateGenerator/ContractWorkspace.TemplateGenerator.csproj
```

Templates are written to
`src/ContractWorkspace.DocumentService/wwwroot/Templates/` and served at
`GET /Templates/{file}.docx`. The catalog is `GET /Templates/templates.json`.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/documenteditor/Import` | Word file → SFDT for the editor |
| `POST /api/documenteditor/SystemClipboard` | Clipboard HTML/RTF → SFDT (paste with formatting) |
| `POST /api/documenteditor/RestrictEditing` | Password hash pair for document protection |
| `POST /api/documenteditor/SpellCheck` / `SpellCheckByPage` | Hunspell spell check (optional) |
| `POST /api/documenteditor/ExportSFDT` | SFDT → DOCX/RTF/HTML/PDF/etc. |
| `POST /api/documenteditor/ExportPdf` | Clean PDF (comments and tracked changes stripped) |
| `POST /api/documenteditor/ExportCleanDocx` | Clean DOCX (comments and tracked changes stripped) |
| `POST /api/documenteditor/Save` | Persist a template `.docx` under `wwwroot/Templates/` |
| `POST /api/documenteditor/MailMerge` | DocIO mail merge on a base64 DOCX → merged SFDT |
| `POST /api/documenteditor/GetMergeFieldNames` | List merge-field names in an uploaded DOCX |
| `POST /api/documenteditor/CompareDocuments` | DOCX ↔ DOCX comparison (`WordDocument.Compare`) |
| `GET /Templates/{file}.docx` | Static template file |
| `GET /Templates/templates.json` | Template catalog used by the React dashboard |
| `GET /health` | Liveness probe |

## Testing

```bash
cd server-side
dotnet test ContractWorkspace.DocumentService.sln
```

Integration tests in `tests/ContractWorkspace.DocumentService.Tests/` boot the
service in-process and cover health, Import, GetMergeFieldNames, MailMerge,
CompareDocuments, and ExportPdf against the generated templates.

## Architecture

Stateless ASP.NET Core web API: no database and no business-data persistence.

- `Controllers/DocumentEditorController.cs` — editor endpoints
- `Controllers/HealthController.cs` — liveness probe
- `Models/RequestModels.cs` — request/response DTOs
- `Helpers/MailMergeDataAdapter.cs` — JSON → DataTable mail-merge helper and format mapping
- `wwwroot/Templates/` — template DOCX files and `templates.json`
- `App_Data/` — optional Hunspell dictionaries

`ContractWorkspace.TemplateGenerator` is a console project that regenerates the
template DOCX files.

## Legal disclaimer

All template text, clause placeholders, and merge-field values are fictional
synthetic content created for demonstration. Nothing in this service constitutes
legal advice. Signature handling in the showcase is an image-based approval
signature, not a certificate-backed digital signature.
