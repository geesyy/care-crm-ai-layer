const { z } = require('zod');
const { callLLM } = require('../harness/llmHarness');

const inputSchema = z.object({
  clinicalNotes: z.string().min(1, 'clinicalNotes is required'),
});

const outputSchema = z.object({
  summary: z.string(),
  conditions: z.array(z.string()),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  riskFlags: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are a clinical summarization assistant for a residential care facility intake process.
Read the raw clinical notes for a new resident and extract a structured summary.

Rules:
1. Base every field strictly on the notes provided. Never invent a condition, medication, or allergy that is not stated or clearly implied.
2. "riskFlags" should call out anything a caregiver needs to know on day one (e.g. fall risk, swallowing precautions, wandering risk, severe allergy).
3. "summary" is 2-4 plain sentences a non-clinical staff member can understand.
4. If the notes do not mention a category (e.g. no allergies listed), return an empty array — do not fabricate "none reported" unless the notes explicitly say so.`;

async function runMedicalHistoryAgent({ clinicalNotes, simulate } = {}) {
  return callLLM({
    agentName: 'medicalHistory',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Clinical notes:\n\n${clinicalNotes}`,
    inputSchema,
    outputSchema,
    input: { clinicalNotes },
    simulate,
  });
}

module.exports = { runMedicalHistoryAgent, inputSchema, outputSchema };
