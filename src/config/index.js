require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3002,
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  },
  harness: {
    maxRetries: parseInt(process.env.HARNESS_MAX_RETRIES, 10) || 3,
    baseDelayMs: parseInt(process.env.HARNESS_BASE_DELAY_MS, 10) || 500,
    timeoutMs: parseInt(process.env.HARNESS_TIMEOUT_MS, 10) || 15000,
  },
  incident: {
    maxValidationIterations: parseInt(process.env.INCIDENT_MAX_VALIDATION_ITERATIONS, 10) || 4,
  },
};
