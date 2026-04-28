# KoinX Transaction Reconciliation Engine

## Overview
This is a Node.js-based Transaction Reconciliation Engine. It ingests CSV exports from a user and an exchange, parses the transactions, stores them in MongoDB, and runs a matching engine to reconcile them based on configurable tolerances (timestamp and quantity).

## Setup & Installation

1. **Clone the repository:**
   \`\`\`bash
   git clone <repo-url>
   cd koinx-reconciliation
   \`\`\`

2. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure Environment Variables:**
   A `.env` file is provided by default. If not, create one with the following:
   \`\`\`env
   PORT=3000
   MONGO_URI=mongodb://127.0.0.1:27017/koinx_reconciliation
   TIMESTAMP_TOLERANCE_SECONDS=300
   QUANTITY_TOLERANCE_PCT=0.01
   \`\`\`
   *Make sure MongoDB is running locally or provide a valid Atlas URI.*

4. **Start the server:**
   \`\`\`bash
   npm start
   # or for development:
   npm run dev
   \`\`\`

## API Endpoints

- **\`POST /api/reconcile\`**
  Upload two files: \`userFile\` and \`exchangeFile\` (multipart/form-data).
  Optional body params: \`timestampToleranceSeconds\`, \`quantityTolerancePct\`
  Returns: \`runId\`

- **\`GET /api/report/:runId\`**
  Returns the full reconciliation report for the specified run.

- **\`GET /api/report/:runId/summary\`**
  Returns a count summary of matched, conflicting, and unmatched records.

- **\`GET /api/report/:runId/unmatched\`**
  Returns only the unmatched transactions.
  1. Trigger Reconciliation (POST)
Uploads files and initiates the matching engine.

 \`\`\`bash
curl.exe -F "userFile=@test_user.csv" -F "exchangeFile=@test_exchange.csv" http://localhost:3000/api/reconcile
Response: Returns a runId (e.g., d1a99380-b7eb-477d-979f-6096001a7754).

2. Get Summary Report (GET)
Returns a high-level count of matched, unmatched, and conflicting records.

 \`\`\`bash
curl.exe http://localhost:3000/api/report/<YOUR_RUN_ID>/summary
3. Get Full Detailed Report (GET)
Returns the complete list of processed transactions and their individual matching statuses.

 \`\`\`bash
curl.exe http://localhost:3000/api/report/<YOUR_RUN_ID>
4. Get Unmatched Records (GET)
Filters the report to show only transactions that could not be reconciled.

 \`\`\`bash
curl.exe http://localhost:3000/api/report/<YOUR_RUN_ID>/unmatched

## Key Decisions & Assumptions

1. **CSV Column Names:** As the specific column names from the assignment were intentionally obfuscated or unclear, the ingestion service dynamically searches for common headers (`type`, `transaction_type`, `asset`, `coin`, `timestamp`, `date`, `quantity`, `amount`) case-insensitively.
2. **"Bad Row" Handling:** Rather than dropping rows with missing essential data, the ingestion service flags them as `isBadRow=true` with a `rejectReason`. These are included in the final report as unmatched entries.
3. **Database Schema:** We use a `Transaction` collection to store raw rows from both sources and a `ReconciliationReport` collection to link them. This allows us to serve the REST API quickly instead of recalculating on the fly.
4. **Matching Logic:** 
   - We normalize assets (`BITCOIN` -> `BTC`).
   - We map opposite sides for comparison (`TRANSFER_OUT` from User matches `TRANSFER_IN` from Exchange).
   - If multiple matches fall within tolerances, we pick the first one and remove it from the pool to avoid double matching.
