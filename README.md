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

- PDF up to 10 MB; pasted text up to 160,000 characters; prompt up to 4,000 characters.
- The configured model reads native PDF input. No separate local OCR is included; unreadable content must be reported as insufficient evidence.
- Active real passages are ranked by question keywords and participant/revenue synonyms. Up to 60,000 characters of complete passages are sent. Small libraries are included in full. This is lightweight retrieval, not embedding search. Omitted passage counts are disclosed; library completeness and applicability still require human review.
- Answers include aspect-specific findings, TOR locations and quotations, reference citations, numerical reasoning, follow-up options, and limitations.
- The server checks reference quotes against retrieved database text, and TOR quotes against pasted text. Invalid evidence downgrades a finding to insufficient evidence. PDF quotations and page numbers still require review against the original file.
- An indicative index averages evidenced aspects: aligned 100, partial 50, discrepancy 0. Unknown aspects are excluded and coverage is displayed. No evidence means no score. This is neither an accuracy probability nor a whole-document approval.
- Evaluators may mark a result reviewed. This does not approve or reject the TOR. JSON export includes citations, scope, limitations, and review state.
- Real AI calls require credentials and real references. No external AI call was made during development; provider tests use fixtures.

## Structure and checks

- `src/AIWorkspace.jsx`, `src/workspace.css`: active UI.
- `server/database.js`: SQLite schema, transactional import, passage retrieval.
- `server/analysis.js`: input validation, Responses integration, citation checks.
- `server/api.js`: same-origin API, upload limit, timeout, concurrency limit.
- `server/demo.js`: fictional seed and prepared simulation.
- `server/index.js`: production server.
- `npm test`: eight tests covering database, simulation isolation, citation validity, coverage, PDF validation, and mocked Responses integration.

Previous manual evaluation components remain in the source tree for reference but are not loaded by the active UI.
