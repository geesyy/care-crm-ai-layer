# Care CRM — AI Layer (Residential Care CRM)

AI layer for a CRM/operating system for residential care facilities for the elderly: a reusable LLM harness, an agent swarm for resident intake, and an incident-reporting workflow with a validation loop and a max-iteration guard. This does not include the full CRM (chart UI, staff scheduling, etc.) — just the AI layer, exposed via REST, per the challenge brief.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Express |
| LLM | Anthropic Claude (`@anthropic-ai/sdk`), structured output via forced tool-use |
| Schema validation | `zod` (+ `zod-to-json-schema` to generate the tool's `input_schema`) |
| State | In-memory (audit trail, no persistence) |
| Tests | `node --test` (no external framework, same pattern as the earlier challenges) |

## Requirements covered

| Requirement | Implementation |
|-------------|-----------------|
| 1. Reusable harness | `src/harness/llmHarness.js` |
| 2. Resident intake agent swarm | `src/workflows/intake.workflow.js` + `src/agents/*` |
| 3. Looping incident-reporting workflow | `src/workflows/incident.workflow.js` |

## Setup

```bash
cd care-crm-ai-layer
cp .env.example .env
# set ANTHROPIC_API_KEY in .env
npm install
npm run dev
```

Server at `http://localhost:3002`.

```bash
npm test
```

## Architecture

```
care-crm-ai-layer/
├── src/
│   ├── harness/
│   │   ├── llmHarness.js   # reusable core — every agent goes through this
│   │   └── logger.js       # structured logging + redaction
│   ├── agents/             # each agent is a thin function: prompt + schemas + harness call
│   │   ├── medicalHistory.agent.js
│   │   ├── regulatoryCompliance.agent.js
│   │   ├── familyCommunication.agent.js
│   │   ├── incidentClassifier.agent.js
│   │   └── incidentValidator.agent.js
│   ├── workflows/
│   │   ├── intake.workflow.js    # resident intake swarm orchestrator
│   │   └── incident.workflow.js # classify → route → validation loop → escalate → audit
│   ├── data/
│   │   ├── stateRegulations.js   # mock regulatory ground truth, by state
│   │   ├── incidentRouting.js    # deterministic routing (not an LLM decision)
│   │   └── auditLog.store.js     # in-memory, append-only audit trail
│   ├── routes/ controllers/ middleware/ utils/
│   └── app.js / server.js
├── sample-payloads/    # example payloads, including the 3 demo scenarios
└── tests/
```

## 1. Harness (`src/harness/llmHarness.js`)

A single `callLLM(...)` function that **every agent** calls — no agent talks to the Anthropic SDK directly.

- **Input and output schema validation**: `inputSchema`/`outputSchema` in `zod`. Input is validated before any network call. Output is forced via Anthropic tool-use — a `submit_result` tool whose `input_schema` is generated from the zod schema (`zod-to-json-schema`) — instead of fragile free-text JSON parsing, then re-validated against that same zod schema.
- **Retry with exponential backoff**: on 429/5xx errors (mapped to `UpstreamRateLimitError`/`UpstreamServerError`), waits `baseDelayMs * 2^attempt + jitter` (honoring `retry-after` when present), up to `maxRetries` (default 3).
- **Configurable timeout with graceful fallback**: every call has a `timeoutMs` (default 15s); a timeout does **not** enter the retry loop — it goes straight to the configured `fallback` (value or function) if one exists, otherwise it propagates a typed error.
- **Logging with redaction**: every call (request/retry/error/fallback/response) is logged via `logger.js`. `redact()` masks by field name (`ssn`, `dob`, `phone`, `email`, `medicalRecordNumber`, etc.) and by regex pattern in free text (SSN, phone, email) — a second layer of defense for clinical notes and incident narratives.
- **Simulation hook (`simulate`)**: lets you force `rate_limit` / `server_error` / `timeout` without calling the real API, failing deterministically for N attempts before returning a `successValue`. Used by the three demo endpoints below and by the tests, so resilience behavior is demonstrable and testable without depending on a real provider outage.

## 2. Resident intake swarm (`POST /api/intake`)

```
            ┌────────────────────┐
 intake ──► │ medicalHistory      │──┐
   form     │ (clinical notes)    │  │
            └────────────────────┘  │   medicalSummary (if available)
                                     ▼
            ┌────────────────────┐  ┌──────────────────────┐
            │ regulatoryCompliance│  │ familyCommunication  │
            │ (care plan vs.      │  │ (degrades gracefully │
            │  state requirements)│  │  without the medical │
            │                     │  │  summary)            │
            └────────────────────┘  └──────────────────────┘
```

- `medicalHistory` and `regulatoryCompliance` run **in parallel** (`Promise.allSettled`) — they're independent.
- `familyCommunication` runs afterward, using the medical summary **if available**; if `medicalHistory` failed, it degrades and writes the welcome message from the care plan alone, without inventing clinical details.
- Each sub-agent failure is isolated (`try`/`catch` per agent, never takes down the orchestrator). The final response includes `completedAgents`, `incompleteAgents` (with a reason for each), and `requiresHumanReview`.
- `regulatoryCompliance` uses `src/data/stateRegulations.js` as ground truth injected into the prompt — the LLM compares what's documented against that list, instead of "recalling" regulations from training data (which could be wrong or outdated).

## 3. Incident workflow (`POST /api/incidents`)

```
description ──► incidentClassifier ──► resolveRoute() ──► incidentValidator ──┐
 (LLM)                                  (fixed table,         (LLM)            │
                                          not the LLM)           ▲              │
                                                                  └── loop ──────┘
                                                       (up to maxIterations, then escalates)
```

1. **Classification** (`incidentClassifier.agent.js`): type + severity, structured output.
2. **Deterministic routing** (`src/data/incidentRouting.js`): type+severity → regulatory notification path + required fields. A fixed table in code, not an LLM decision — we don't want a model improvising on a compliance-critical path.
3. **Validation loop** (`incidentValidator.agent.js`): checks the chosen route's required fields; re-iterates while fields are missing, up to `INCIDENT_MAX_VALIDATION_ITERATIONS` (default 4). If it never converges, `status: "escalated_to_human"`.
4. **Audit trail**: every step (`started`, `classified`, `routed`, `validation_iteration` × N, `escalated`/`completed`) is a JSON record in `auditLog.store.js`, retrievable via `GET /api/incidents/:incidentId/audit`.

## Demo endpoints

```bash
# 1) Harness — simulated rate limit: recovers after 2 attempts, or exhausts and falls back
curl -X POST http://localhost:3002/api/harness/demo -H "Content-Type: application/json" -d '{"mode":"recovers"}'
curl -X POST http://localhost:3002/api/harness/demo -H "Content-Type: application/json" -d '{"mode":"exhausts"}'

# 2) Intake swarm — one sub-agent forced to fail (regulatoryCompliance)
curl -X POST http://localhost:3002/api/intake -H "Content-Type: application/json" -d @sample-payloads/intake-simulated-failure.json

# 3) Incident — validation loop never converges, hits the guard and escalates
curl -X POST http://localhost:3002/api/incidents -H "Content-Type: application/json" -d @sample-payloads/incident-loop-guard.json

# Happy paths (require a real ANTHROPIC_API_KEY)
curl -X POST http://localhost:3002/api/intake -H "Content-Type: application/json" -d @sample-payloads/intake-complete.json
curl -X POST http://localhost:3002/api/incidents -H "Content-Type: application/json" -d @sample-payloads/incident-fall.json
```

## Tradeoffs

1. **Forcing output via tool-use instead of free-text JSON** — more setup, but eliminates fragile parsing and gives a more reliable schema check on the model's output.
2. **`simulate` in the harness instead of only mocking the HTTP client in tests** — lets resilience be demonstrated via `curl`/video without depending on a real provider failure, at the cost of one extra parameter that exists only for demo/test purposes.
3. **Incident routing is deterministic code, not an agent** — correct for a regulatory path, but means adding a new incident type requires editing `incidentRouting.js`, not just adjusting a prompt.
4. **No real human in the validation loop** — the brief asks for the loop plus the iteration guard; a real product would re-present the `clarifyingQuestions` to the user between iterations. Here, with no human re-entry, a payload with a permanently missing field converges to escalation — which is exactly the behavior the guard exists to produce.
5. **In-memory state** — the audit trail and everything else disappears on process restart. Acceptable for this challenge; production would require durable, ideally immutable storage — see the written answer for Section C2.

## Known limitations

- `redact()` masks by field name + regex patterns (SSN, phone, email) in free text — not full PII detection (NER). Proper names or other identifiers in free text may not be masked in the logs.
- No authentication on the endpoints — any caller can trigger LLM calls (cost) or submit resident data.
- `stateRegulations.js` and `incidentRouting.js` are mock tables for 4 states — not a real regulatory source.
- No rate limiting per caller.
