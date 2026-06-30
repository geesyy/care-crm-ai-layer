const { z } = require('zod');
const { callLLM } = require('../harness/llmHarness');

const inputSchema = z.object({
  requiredFields: z.array(z.string()),
  incidentReport: z.record(z.any()),
});

const outputSchema = z.object({
  complete: z.boolean(),
  missingFields: z.array(z.string()),
  clarifyingQuestions: z.array(z.string()),
});

const SYSTEM_PROMPT = `You validate whether an incident report contains every legally required field for the regulatory notification path that was already determined for it.

Rules:
1. Only check the fields listed in "requiredFields" — do not require anything else.
2. A field counts as missing if it is absent, null, an empty string, or a placeholder like "TBD", "n/a", "unknown", or "pending".
3. "complete" is true only if missingFields is empty.
4. For each missing field, add one short, specific clarifying question a staff member could answer to fill it in (e.g. "Was the resident's physician notified, and if so when?").`;

async function runIncidentValidatorAgent({ requiredFields, incidentReport, simulate } = {}) {
  const userPrompt = `Required fields for this notification path: ${JSON.stringify(requiredFields)}

Incident report as submitted:
${JSON.stringify(incidentReport, null, 2)}`;

  return callLLM({
    agentName: 'incidentValidator',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    inputSchema,
    outputSchema,
    input: { requiredFields, incidentReport },
    simulate,
  });
}

module.exports = { runIncidentValidatorAgent, inputSchema, outputSchema };
