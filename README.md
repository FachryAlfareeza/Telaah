# Telaah — Pengajuan kegiatan Satker & telaah Rocan

Telaah is a local mockup for activity submissions, initial AI screening, and human review. Satker submits activities with TOR/RAB; Rocan reviews submissions and manages the reference library. AI screening supports the decision. Only Rocan approves or rejects an activity.

## Run

Requires Node 22.13+ (`node:sqlite` is experimental on Node 22).

```sh
npm install
npm run dev
```

Or double-click `start.cmd`. Vite serves both the UI and API. For production build testing, run `npm run build`, then `npm start` (http://127.0.0.1:4173).

## Try the two roles

1. Choose **Demo Satker** on the login screen, or register a local example account with the Satker role and unit name.
2. Select **Ajukan kegiatan**, enter title, description, activity date, and type. Upload one PDF containing both TOR and RAB, or separate TOR and RAB PDFs. Each file is limited to 10 MB.
3. For offline workflow testing, explicitly choose **Simulasi · lanjut ke Rocan** or **Simulasi · perlu perbaikan**. These are prepared examples and do not analyze uploaded content. All simulation findings and submissions are labeled.
4. Satker sees correction findings and can revise and resubmit a returned application. Existing PDFs may be retained when revising.
5. Log out and choose **Demo Rocan**. The same server database supplies submissions across Satker accounts. Sort by submission time and filter by submission date, Satker, or status.
6. Open a submission to download TOR/RAB, inspect the full screening table and confidence, and approve, reject, or return it with a required decision note. Review acknowledgment is required in the UI.
7. In **Dokumen acuan**, upload reference PDFs, set validity start/end dates, and enable or disable their use. Leave the end date blank for an open-ended period.

## Workflow states

| Status | Meaning / next action |
| --- | --- |
| Menunggu screening | Submission is saved; retry screening if AI or references are unavailable. |
| Perlu perbaikan | Fatal screening finding or Rocan requests changes; Satker edits and resubmits. |
| Menunggu Rocan | Screening has no fatal findings; awaiting a human decision. |
| Perlu telaah manual | Evidence or mandatory screening aspects are incomplete; Rocan must review. |
| Disetujui / Ditolak | Rocan's recorded decision and reason are visible to Satker. |

The table shows all submissions, including those awaiting screening or revision. Only submissions awaiting Rocan or manual review expose decision controls. Screening never approves or rejects an activity. History records submission, screening, resubmission, and human decisions.

## Reference validity

Screening selects enabled references whose inclusive validity period contains the **activity date**. The library's **Status hari ini** is calculated separately using today's date in Asia/Jakarta. A future or expired reference can therefore apply to an activity within its period. Manual deactivation excludes the reference regardless of dates.

Changes apply to future screenings; stored results retain the reference metadata and findings used at screening time. To replace a PDF, add a new reference/version and disable the old one as needed. This mockup does not automatically resolve conflicting or superseded regulations.

## Enable actual AI screening

1. Copy `.env.example` to `.env`, then set `OPENAI_API_KEY` and `OPENAI_MODEL` to an accessible model supporting PDF inputs and structured outputs. Never expose keys using `VITE_*` variables.
2. Log in as Rocan and upload real reference PDFs with their validity periods.
3. Restart after environment configuration changes. Submit with **AI · dokumen sebenarnya** selected, or retry a saved pending submission.

The server sends TOR, optional separate RAB, and applicable reference PDFs through the OpenAI Responses API with `store: false`. Native PDF input follows the [official file-input guide](https://developers.openai.com/api/docs/guides/file-inputs). Real screening is limited to eight applicable reference PDFs and 40 million base64 reference characters per request; exceeding the limit leaves screening pending instead of silently omitting references. Two screenings can run concurrently, with a 120-second timeout. Provider context limits may impose smaller practical limits.

Screening covers document completeness, goals, needs/volume, rates, allocation, and TOR/RAB total consistency. Missing returned aspects are explicitly marked as insufficient evidence. Unknown reference IDs and missing quotes/locations cannot substantiate fatal findings. PDF quotations and arithmetic still require human verification; the app does not independently extract and verify PDF text.

**Confidence is an AI self-estimate, not a calibrated probability or a compliance score.** Rocan sees per-finding confidence and an unweighted mean when every finding is assessable. If any aspect lacks evidence, overall confidence is unavailable. Satker receives correction findings without internal confidence values. No live provider calls were used in development verification; tests mock provider responses.

The separate indicative alignment index averages evidenced findings (aligned 100, partial 50, discrepancy 0). Insufficient-evidence findings are excluded and evidence coverage is displayed. This index is not an approval or a measurement of the entire activity's correctness.

## Storage and mock authentication

The app creates `data/references.sqlite` automatically (override with `REFERENCE_DB`). The `workflow_records` table persists activity metadata, PDF bytes encoded as base64, reference periods, screening snapshots, and decisions. Uploaded documents now remain on the local server for Rocan review; they are not discarded after screening. Back up the database to preserve them.

Login/register remains a **local UI mockup**: salted PBKDF2 password hashes are stored in browser local storage and the signed-in profile in session storage. API role/ownership checks use the client-supplied `X-Telaah-Profile` header, which is not trustworthy authentication. Self-selecting Rocan is only for mockup testing. Before shared/public deployment, replace this with server-verified sessions, managed role assignment, and a file retention/access policy. Use example credentials and data for this mockup.

The prior single-TOR analysis and reference-passage CLI remain in the repository for compatibility. Their `documents`/`passages` library is separate from the new PDF reference library; the new workflow uses references uploaded by Rocan. Existing browser accounts without a role default to Satker.


## File structure

```text
Telaah/
├── public/
│   └── theme-init.js          # Apply saved theme before the page renders
├── src/
│   ├── main.jsx               # React entry point and stylesheet imports
│   ├── AuthApp.jsx            # Mock login, registration, and session handling
│   ├── WorkflowApp.jsx        # Satker submissions, Rocan review, reference library
│   ├── workflow.css           # Responsive workflow and role dashboards
│   ├── AIWorkspace.jsx        # Previous single-TOR analysis workspace
│   ├── CheckTables.jsx        # Editable checks and results tables
│   ├── ThemeToggle.jsx        # Light/dark mode control
│   ├── demo-content.js        # Sample TOR and question
│   ├── styles.css             # Base styles and shared layout
│   ├── workspace.css          # Analysis workspace styles
│   ├── auth.css               # Login and registration styles
│   ├── theme.css              # Theme colors and overrides
│   ├── tables.css             # Tables, readability, and responsive overrides
│   ├── AlignmentApp.jsx       # Previous manual evaluation UI
│   ├── alignment.js           # Previous manual scoring logic
│   ├── alignment.test.js      # Tests for the previous scoring logic
│   └── data.js                # Previous manual evaluation data
├── server/
│   ├── index.js               # Production UI and API server
│   ├── api.js                 # API routes, request limits, and timeouts
│   ├── workflow-api.js        # Role-aware submission and reference endpoints
│   ├── workflow.js            # SQLite records, validation, periods, decisions
│   ├── workflow-screening.js  # Multi-PDF screening and labeled simulation
│   ├── workflow.test.js       # Role, workflow, period, and AI fixture tests
│   ├── analysis.js            # AI requests, validation, and citation checks
│   ├── batch.js               # Multiple-check validation and result coverage
│   ├── database.js            # SQLite storage and reference retrieval
│   ├── import-references.js   # Administrator reference import CLI
│   ├── demo.js                # Fictional references and simulation results
│   └── analysis.test.js       # Backend and mocked AI integration tests
├── data/
│   └── references.sqlite      # Generated local database (Git-ignored)
├── dist/                      # Generated production build (Git-ignored)
├── node_modules/              # Installed dependencies (Git-ignored)
├── .env.example               # Server configuration template
├── .gitignore                 # Files excluded from version control
├── index.html                 # HTML entry point
├── package.json               # Dependencies and npm scripts
├── package-lock.json          # Locked dependency versions
├── start.cmd                  # Windows development launcher
├── vite.config.js             # Vite configuration and development API
└── README.md                  # Setup, usage, and project documentation
```

The database is generated on first use; `dist/` is generated by `npm run build`, and `node_modules/` by `npm install`. Local configuration belongs in a Git-ignored `.env` file copied from `.env.example`.


## Checks

Run `npm test` for the backend and workflow tests, and `npm run build` for the production UI build. Tests cover combined/separate uploads, validity boundaries, role visibility, revision/resubmission/decision flow, incomplete evidence, and mocked multi-PDF AI requests.
