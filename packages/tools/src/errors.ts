/**
 * Sanitizes strings to prevent accidental leakage of secrets, auth headers,
 * tokens, or sensitive credentials in logs and error traces.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return "";
  return message
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(token=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(key=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(apiKey=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(lin_api_[A-Za-z0-9_]+)/gi, "[REDACTED]")
    .replace(/(ghp_[A-Za-z0-9_]+)/gi, "[REDACTED]")
    .replace(/(github_pat_[A-Za-z0-9_]+)/gi, "[REDACTED]");
}

/**
 * Base error class for all tool layer errors.
 */
export class ToolError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;

  constructor(message: string, code = "TOOL_ERROR", statusCode = 500) {
    super(sanitizeErrorMessage(message));
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends ToolError {
  constructor(message = "Authentication failed: invalid or missing provider credentials.") {
    super(message, "AUTHENTICATION_ERROR", 401);
  }
}

export class AuthorizationError extends ToolError {
  constructor(message = "Authorization failed: insufficient permissions or scopes for requested resource.") {
    super(message, "AUTHORIZATION_ERROR", 403);
  }
}

export class NotFoundError extends ToolError {
  constructor(resource: string) {
    super(`Resource not found: ${resource}`, "NOT_FOUND", 404);
  }
}

export class RateLimitError extends ToolError {
  readonly retryAfterSeconds?: number;

  constructor(message = "API rate limit exceeded.", retryAfterSeconds?: number) {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ProviderValidationError extends ToolError {
  constructor(message: string) {
    super(message, "PROVIDER_VALIDATION_ERROR", 422);
  }
}

export class ProviderUnavailableError extends ToolError {
  constructor(message = "External provider service is temporarily unavailable.") {
    super(message, "PROVIDER_UNAVAILABLE", 503);
  }
}

export class TenantIsolationError extends ToolError {
  constructor(message: string) {
    super(message, "TENANT_ISOLATION_VIOLATION", 403);
  }
}

export class CoworkerPermissionError extends ToolError {
  constructor(message: string) {
    super(message, "COWORKER_PERMISSION_DENIED", 403);
  }
}
