# ClosingDesk

ClosingDesk helps a real estate attorney check a purchase and sale agreement against the accepted offer. It is a draft review. It is not a legal determination.

The current module is Offer vs. PSA. Later modules (closing documents, title, checklist, settlement, communications, post-closing) are listed in the sidebar and are not built yet.

## Run

```bash
cd closingdesk
npm install
npm run dev
```

Open http://localhost:3000 and sign in. In local development the attorney account is:

`vitaliy@closingdesk.local` / `harbor-pine`

Use **Load sample** for a transaction whose purchase agreement changes the price words into an equivalent amount, moves the closing date, changes the deposit and financing, drops the inspection and appraisal, and adds an assignment clause.

## What it stores

Uploaded files and the matter database are encrypted at rest (AES-256-GCM). Keys stay on the server. In production set:

- `CLOSINGDESK_SESSION_SECRET`
- `CLOSINGDESK_FILE_KEY`
- `CLOSINGDESK_ATTORNEY_PASSWORD`

See `.env.example`. `CLOSINGDESK_RETENTION_DAYS` deletes stored documents older than that many days.

`db/schema.sql` is the PostgreSQL shape for the same entities (users, matters, documents, versions, extracted terms, comparison runs, findings, attorney reviews, audit events). The running app uses the encrypted file store so it works without a database server.

## Comparison

Amounts, dates, names, and known contingencies are compared in application code. Wording that carries the same parsed value is **Equivalent**. A conflict of parsed values is a **Discrepancy**. An offer term with no counterpart is **Missing**. A purchase-agreement term the offer never addressed is a **New provision**, which is flagged for review and is not treated as an error by itself. If extraction fails or a conclusion is not supported, the status is **Unclear**. The app does not invent terms.

An optional server-side model (`OPENAI_API_KEY`) may refine wording. Document text is sent only from the server, inside untrusted-data tags. The model cannot turn a parsed price or date conflict into a match, and a quote that is not in the source document is dropped. API data is not used to train a model by the application. Attorney actions are stored separately from the original finding.

PDF and DOCX text are extracted on the server. Image-only scans are flagged. OCR is not enabled.

## Tests

```bash
npm test
```
