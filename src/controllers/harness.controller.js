const { z } = require('zod');
const { callLLM } = require('../harness/llmHarness');

const demoOutputSchema = z.object({
  status: z.string(),
  message: z.string(),
});

// Demo-only endpoint: exercises the harness's retry/backoff/fallback behavior
// against a *simulated* Anthropic failure so the resilience logic can be shown
// on video without depending on a real provider outage or burning API quota.
async function runHarnessDemo(req, res, next) {
  try {
    const mode = req.body?.mode === 'exhausts' ? 'exhausts' : 'recovers';

    const simulate =
      mode === 'recovers'
        ? {
            type: 'rate_limit',
            failCount: 2,
            successValue: {
              status: 'recovered',
              message: 'Succeeded after 2 simulated 429 responses and exponential backoff.',
            },
          }
        : { type: 'rate_limit', failCount: 999 };

    const result = await callLLM({
      agentName: 'harnessDemo',
      systemPrompt: 'unused in simulate mode',
      userPrompt: 'unused in simulate mode',
      outputSchema: demoOutputSchema,
      input: {},
      simulate,
      maxRetries: 3,
      fallback:
        mode === 'exhausts'
          ? {
              status: 'degraded',
              message: 'All retries exhausted — falling back to a safe default instead of failing the request.',
            }
          : undefined,
    });

    res.json({ mode, result });
  } catch (err) {
    next(err);
  }
}

module.exports = { runHarnessDemo };
