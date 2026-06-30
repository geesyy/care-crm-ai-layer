const { z } = require('zod');
const { callLLM } = require('../harness/llmHarness');
const { getStateRegulations } = require('../data/stateRegulations');
const { ValidationError } = require('../utils/errors');

const inputSchema = z.object({
  state: z.string().length(2),
  carePlanNarrative: z.string().min(1),
  documentedElements: z.array(z.string()),
});

const outputSchema = z.object({
  state: z.string(),
  status: z.enum(['compliant', 'non_compliant', 'needs_review']),
  missingElements: z.array(z.string()),
  violations: z.array(z.string()),
  requiredActions: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are a regulatory compliance reviewer for residential care facility care plans.
You are given the authoritative list of required care plan elements for the resident's state and what is actually documented.

Rules:
1. Treat the provided "required elements" list as ground truth. Do not invent or assume additional state requirements beyond what is given.
2. "missingElements" = required elements not present in documentedElements (compare by meaning, not exact string match).
3. "violations" describes concrete regulatory gaps in plain language, e.g. "No fall risk assessment on file, required by state regulation."
4. status = "compliant" only if nothing is missing. "non_compliant" if required elements are missing. "needs_review" if the narrative is too vague to tell.
5. "requiredActions" are concrete next steps staff must take before the plan can be approved.`;

async function runRegulatoryComplianceAgent({ state, carePlanNarrative, documentedElements, simulate } = {}) {
  const regulations = getStateRegulations(state);
  if (!regulations) {
    throw new ValidationError(`No regulatory data available for state "${state}"`);
  }

  const userPrompt = `State: ${state} (${regulations.agencyName})
Required care plan elements per state regulation: ${JSON.stringify(regulations.requiredCarePlanElements)}

Resident's documented care plan elements: ${JSON.stringify(documentedElements)}
Care plan narrative:
${carePlanNarrative}`;

  return callLLM({
    agentName: 'regulatoryCompliance',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    inputSchema,
    outputSchema,
    input: { state, carePlanNarrative, documentedElements },
    simulate,
  });
}

module.exports = { runRegulatoryComplianceAgent, inputSchema, outputSchema };
