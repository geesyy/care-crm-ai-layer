class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class UpstreamRateLimitError extends AppError {
  constructor(message = 'LLM provider rate limit exceeded') {
    super(message, 429, 'LLM_RATE_LIMIT');
  }
}

class UpstreamServerError extends AppError {
  constructor(message = 'LLM provider returned a server error') {
    super(message, 502, 'LLM_UPSTREAM_ERROR');
  }
}

class LLMTimeoutError extends AppError {
  constructor(message = 'LLM call timed out') {
    super(message, 504, 'LLM_TIMEOUT');
  }
}

class LLMOutputValidationError extends AppError {
  constructor(message, details) {
    super(message, 502, 'LLM_OUTPUT_VALIDATION_ERROR');
    this.details = details;
  }
}

class MaxIterationsExceededError extends AppError {
  constructor(message = 'Validation loop exceeded the maximum number of iterations') {
    super(message, 409, 'MAX_ITERATIONS_EXCEEDED');
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UpstreamRateLimitError,
  UpstreamServerError,
  LLMTimeoutError,
  LLMOutputValidationError,
  MaxIterationsExceededError,
};
