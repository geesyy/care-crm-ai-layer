const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { callLLM } = require('../src/harness/llmHarness');

const outputSchema = z.object({ status: z.string() });

test('retries on simulated rate-limit errors and recovers with backoff', async () => {
  const result = await callLLM({
    agentName: 'test',
    outputSchema,
    input: {},
    maxRetries: 3,
    baseDelayMs: 5,
    simulate: { type: 'rate_limit', failCount: 2, successValue: { status: 'ok' } },
  });
  assert.deepEqual(result, { status: 'ok' });
});

test('exhausts retries on repeated 5xx errors and returns the configured fallback', async () => {
  const result = await callLLM({
    agentName: 'test',
    outputSchema,
    input: {},
    maxRetries: 2,
    baseDelayMs: 5,
    simulate: { type: 'server_error', failCount: 999 },
    fallback: { status: 'degraded' },
  });
  assert.deepEqual(result, { status: 'degraded' });
});

test('throws when retries are exhausted and no fallback is configured', async () => {
  await assert.rejects(
    callLLM({
      agentName: 'test',
      outputSchema,
      input: {},
      maxRetries: 1,
      baseDelayMs: 5,
      simulate: { type: 'server_error', failCount: 999 },
    }),
    /Simulated 5xx/
  );
});

test('rejects input that fails schema validation before any provider call', async () => {
  const inputSchema = z.object({ clinicalNotes: z.string().min(1) });
  await assert.rejects(
    callLLM({
      agentName: 'test',
      inputSchema,
      outputSchema,
      input: { clinicalNotes: '' },
      simulate: { type: 'rate_limit', failCount: 0, successValue: { status: 'unused' } },
    }),
    /input failed schema validation/
  );
});

test('times out without retrying and falls back gracefully', async () => {
  const result = await callLLM({
    agentName: 'test',
    outputSchema,
    input: {},
    timeoutMs: 30,
    simulate: { type: 'timeout', timeoutDelayMs: 150 },
    fallback: { status: 'timed-out-fallback' },
  });
  assert.deepEqual(result, { status: 'timed-out-fallback' });
});
