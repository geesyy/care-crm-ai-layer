const { z } = require('zod');
const { callLLM } = require('../harness/llmHarness');

const INCIDENT_TYPES = [
  'fall',
  'medication_error',
  'elopement',
  'injury',
  'death',
  'behavioral',
  'property_damage',
  'other',
];

const inputSchema = z.object({
  description: z.string().min(1),
  state: z.string().length(2),
});

const outputSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  severity: z.enum(['low', 'high']),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

const SYSTEM_PROMPT = `You classify incident reports filed by staff at a residential care facility.

Categories: ${INCIDENT_TYPES.join(', ')}.

Severity rules:
- "high": resulted in or risked serious harm, required hospitalization or physician intervention, involved law enforcement, involved an extended unsupervised absence, or resulted in death.
- "low": no significant harm, fully contained on-site, resolved without external intervention.

Always pick the single best-matching category. If genuinely ambiguous, pick "other" and explain why in the rationale rather than guessing a specific category.`;

async function runIncidentClassifierAgent({ description, state, simulate } = {}) {
  return callLLM({
    agentName: 'incidentClassifier',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `State: ${state}\nIncident description:\n${description}`,
    inputSchema,
    outputSchema,
    input: { description, state },
    simulate,
  });
}

module.exports = { runIncidentClassifierAgent, inputSchema, outputSchema, INCIDENT_TYPES };
