const { z } = require('zod');
const { callLLM } = require('../harness/llmHarness');

const inputSchema = z.object({
  residentFirstName: z.string().min(1),
  carePlanNarrative: z.string().min(1),
  medicalSummary: z.string().optional(),
});

const outputSchema = z.object({
  welcomeMessage: z.string(),
  keyPoints: z.array(z.string()),
});

const SYSTEM_PROMPT = `You write warm, plain-language welcome summaries for the families of new residents at a residential care facility.

Rules:
1. No clinical jargon, no diagnosis codes, no medication dosages — translate into language a worried family member can understand.
2. "welcomeMessage" is 3-5 sentences, warm but factual.
3. "keyPoints" is 3-6 short bullet-style strings covering what the family should know in the first week (visiting, care plan highlights, who to contact).
4. If no medical summary was provided, do not mention medical details at all — focus on the care plan and logistics instead of guessing at clinical needs.`;

async function runFamilyCommunicationAgent({ residentFirstName, carePlanNarrative, medicalSummary, simulate } = {}) {
  const userPrompt = `Resident first name: ${residentFirstName}
Care plan narrative: ${carePlanNarrative}
${
  medicalSummary
    ? `Medical summary (already de-identified, plain-language, from another agent): ${medicalSummary}`
    : 'No medical summary is available — write the welcome message without referencing medical details.'
}`;

  return callLLM({
    agentName: 'familyCommunication',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    inputSchema,
    outputSchema,
    input: { residentFirstName, carePlanNarrative, medicalSummary },
    simulate,
  });
}

module.exports = { runFamilyCommunicationAgent, inputSchema, outputSchema };
