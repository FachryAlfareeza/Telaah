# Telaah — AI-assisted TOR analysis

Users upload a TOR PDF or paste text, then ask a natural-language question. Supporting documents live in a server-side SQLite database. The evaluator does not enter reference documents.

## Run

Requires Node 22.13+ (`node:sqlite` is experimental on Node 22).

```sh
npm install
npm run dev
```

Or double-click `start.cmd`. Vite serves both UI and API. The database is created at `data/references.sqlite` on first use. `npm run build` builds the frontend; `npm start` serves the production UI and API at http://127.0.0.1:4173. This is a local single-user mockup, not an authenticated public service.

## Try immediately

The site opens with a mock login/register screen. Use **Masuk dengan akun demo**, or register an example account on this browser. Names, emails, and salted PBKDF2 password hashes are stored in local storage; the signed-in profile uses session storage. Logout clears the session and returns to login. This is a UI mockup only: it does not protect server APIs, verify email, or provide production authentication. Do not use real credentials.

Click **Coba simulasi**. The server reads fictional references from SQLite and returns a labeled prepared answer for a sample TOR: 80 participants compared with a fictional minimum of 100, and Rp18,000,000 revenue compared with 80 × Rp250,000 = Rp20,000,000. No real regulatory claim is made. Simulation does not call AI, transmit, or overwrite the user's TOR.

## Enable actual AI

1. Copy `.env.example` to `.env`. Set `OPENAI_API_KEY` and `OPENAI_MODEL` to a model accessible to your account supporting PDF input and structured outputs. Never put keys in VITE_* variables.
2. Import real reference passages using the administrator CLI below. Fictional documents are always excluded from real analysis.
3. Restart after configuration changes.

The integration uses the OpenAI Responses API with native PDF input and structured output, with `store: false`. The TOR is transmitted with selected reference passages only when the user submits a real analysis. This app does not persist TOR files or conversations. Provider-side processing policies still apply.

Official integration references: [PDF/file inputs](https://developers.openai.com/api/docs/guides/file-inputs), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Administrator reference import

Prepare a JSON array outside the public web directory. This is a format example, not a real regulation:

```json
[
  {
    "id": "your-stable-document-id",
    "title": "Official regulation title and number",
    "type": "Permen",
    "version": "Verified version / effective date",
    "url": "https://example.org/official-document",
    "active": true,
    "passages": [
      { "location": "Article / paragraph / page", "text": "Verbatim verified provision" }
    ]
  }
]
```

```sh
npm run import:references -- path/to/references.json
```

Imports update by document ID atomically. Split passages longer than 10,000 characters at meaningful section boundaries. Use `active: false` to retire references. The evaluator sees a read-only library. Set `REFERENCE_DB` to change the SQLite path. Do not reuse reserved ID `demo-training`.

## Analysis and limitations

- PDF up to 10 MB; pasted text up to 160,000 characters; up to 10 checks per request, each with an aspect (100 characters) and question (600 characters).
- The configured model reads native PDF input. No separate local OCR is included; unreadable content must be reported as insufficient evidence.
- Active real passages are ranked by question keywords and participant/revenue synonyms. Up to 60,000 characters of complete passages are sent. Small libraries are included in full. This is lightweight retrieval, not embedding search. Omitted passage counts are disclosed; library completeness and applicability still require human review.
- Input and results use tables. Each requested check is retained, including checks with insufficient evidence. Numerical findings show formulas, results, differences, and units; calculations require human review.
- Answers include aspect-specific findings, TOR locations and quotations, reference citations, numerical reasoning, follow-up options, and limitations.
- The server checks reference quotes against retrieved database text, and TOR quotes against pasted text. Invalid evidence downgrades a finding to insufficient evidence. PDF quotations and page numbers still require review against the original file.
- An indicative index averages evidenced aspects: aligned 100, partial 50, discrepancy 0. Unknown aspects are excluded and coverage is displayed. No evidence means no score. This is neither an accuracy probability nor a whole-document approval.
- Evaluators may mark a result reviewed. This does not approve or reject the TOR. JSON export includes citations, scope, limitations, and review state.
- Real AI calls require credentials and real references. No external AI call was made during development; provider tests use fixtures.

## File structure

```text
Telaah/
├── public/
│   └── theme-init.js          # Apply saved theme before the page renders
├── src/
│   ├── main.jsx               # React entry point and stylesheet imports
│   ├── AuthApp.jsx            # Mock login, registration, and session handling
│   ├── AIWorkspace.jsx        # TOR upload, checks, and analysis workflow
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

- `npm test`: ten tests covering database, simulation isolation, citation validity, coverage, PDF validation, and mocked Responses integration.

Previous manual evaluation components remain in the source tree for reference but are not loaded by the active UI.
