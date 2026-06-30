const Anthropic = require('@anthropic-ai/sdk');
const { zodToJsonSchema } = require('zod-to-json-schema');
const config = require('../config');
const logger = require('./logger');
const {
  ValidationError,
  UpstreamRateLimitError,
  UpstreamServerError,
  LLMTimeoutError,
  LLMOutputValidationError,
} = require('../utils/errors');

let defaultClient;

function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return defaultClient;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  return err instanceof UpstreamRateLimitError || err instanceof UpstreamServerError;
}

function computeBackoffMs(baseDelayMs, attempt, err) {
  if (err?.retryAfterMs) return err.retryAfterMs;
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * baseDelayMs;
  return Math.round(exponential + jitter);
}

// Maps raw Anthropic SDK errors onto our typed AppError subclasses so the
// retry loop only ever has to reason about our own error types.
function mapClientError(err) {
  const status = err?.status;
  if (status === 429) {
    const retryAfterHeader = err?.headers?.['retry-after'];
    const mapped = new UpstreamRateLimitError(err.message || 'Rate limited by Anthropic API');
    if (retryAfterHeader) mapped.retryAfterMs = Number(retryAfterHeader) * 1000;
    return mapped;
  }
  if (typeof status === 'number' && status >= 500) {
    return new UpstreamServerError(err.message || 'Anthropic API returned a server error');
  }
  return err;
}

function buildToolSchema(outputSchema) {
  const schema = zodToJsonSchema(outputSchema, { target: 'jsonSchema7' });
  delete schema.$schema;
  return schema;
}

async function invokeAnthropic({ client, systemPrompt, userPrompt, outputSchema, signal }) {
  const tools = outputSchema
    ? [
        {
          name: 'submit_result',
          description: 'Submit the structured result for this task.',
          input_schema: buildToolSchema(outputSchema),
        },
      ]
    : undefined;

  let response;
  try {
    response = await client.messages.create(
      {
        model: config.anthropic.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        ...(tools ? { tools, tool_choice: { type: 'tool', name: 'submit_result' } } : {}),
      },
      { signal }
    );
  } catch (err) {
    throw mapClientError(err);
  }

  if (!tools) {
    const block = response.content.find((b) => b.type === 'text');
    return block?.text?.trim() ?? '';
  }

  const toolBlock = response.content.find((b) => b.type === 'tool_use' && b.name === 'submit_result');
  if (!toolBlock) {
    throw new LLMOutputValidationError('Model did not return the expected structured tool call');
  }
  return toolBlock.input;
}

// `simulate` lets demos/tests exercise retry, backoff, timeout and fallback behavior
// deterministically without depending on a real provider outage. When set, no network
// call is made at all: { type: 'rate_limit' | 'server_error' | 'timeout', failCount, successValue }
async function invokeSimulated({ simulate, attempt }) {
  const failCount = simulate.failCount ?? 0;
  if (attempt < failCount) {
    if (simulate.type === 'timeout') {
      await sleep(simulate.timeoutDelayMs ?? 60000);
    }
    if (simulate.type === 'rate_limit') {
      const err = new UpstreamRateLimitError('Simulated 429 from Anthropic API');
      if (simulate.retryAfterMs) err.retryAfterMs = simulate.retryAfterMs;
      throw err;
    }
    throw new UpstreamServerError('Simulated 5xx from Anthropic API');
  }
  return simulate.successValue;
}

function withTimeout(executor, timeoutMs) {
  const controller = new AbortController();
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new LLMTimeoutError());
    }, timeoutMs);
  });
  return Promise.race([executor(controller.signal), timeoutPromise]);
}

/**
 * Reusable harness every agent in the system must call through.
 * Validates input/output against zod schemas, retries on rate-limit/5xx with
 * exponential backoff, enforces a timeout with optional graceful fallback,
 * and logs every request/response/retry/fallback with sensitive fields redacted.
 */
async function callLLM({
  agentName,
  systemPrompt,
  userPrompt,
  inputSchema,
  outputSchema,
  input,
  timeoutMs = config.harness.timeoutMs,
  maxRetries = config.harness.maxRetries,
  baseDelayMs = config.harness.baseDelayMs,
  fallback,
  simulate,
  client,
}) {
  const startedAt = Date.now();

  let validatedInput = input;
  if (inputSchema) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(`${agentName}: input failed schema validation`, parsed.error.flatten());
    }
    validatedInput = parsed.data;
  }

  logger.log({ agentName, event: 'request', input: logger.redact(validatedInput) });

  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      const raw = simulate
        ? await invokeSimulated({ simulate, attempt })
        : await withTimeout(
            (signal) =>
              invokeAnthropic({
                client: client || getDefaultClient(),
                systemPrompt,
                userPrompt,
                outputSchema,
                signal,
              }),
            timeoutMs
          );

      let data = raw;
      if (outputSchema) {
        const parsedOutput = outputSchema.safeParse(raw);
        if (!parsedOutput.success) {
          throw new LLMOutputValidationError(
            `${agentName}: output failed schema validation`,
            parsedOutput.error.flatten()
          );
        }
        data = parsedOutput.data;
      }

      logger.log({
        agentName,
        event: 'response',
        attempt,
        latencyMs: Date.now() - startedAt,
        output: logger.redact(data),
      });
      return data;
    } catch (err) {
      lastError = err;

      if (err instanceof LLMTimeoutError) {
        logger.log({ agentName, event: 'timeout', attempt, timeoutMs });
        break; // timeouts go straight to fallback/throw, not the retry loop
      }

      if (isRetryable(err) && attempt < maxRetries) {
        const delayMs = computeBackoffMs(baseDelayMs, attempt, err);
        logger.log({ agentName, event: 'retry', attempt, delayMs, error: err.message, code: err.code });
        await sleep(delayMs);
        attempt += 1;
        continue;
      }

      logger.log({ agentName, event: 'error', attempt, error: err.message, code: err.code });
      break;
    }
  }

  if (fallback !== undefined) {
    const fallbackValue = typeof fallback === 'function' ? await fallback(lastError) : fallback;
    logger.log({ agentName, event: 'fallback', reason: lastError.message });
    return fallbackValue;
  }

  throw lastError;
}

module.exports = { callLLM, isRetryable, computeBackoffMs, mapClientError };
