/**
 * Retry logic for MS Teams Webhook Action
 * Implements exponential backoff with jitter for transient failures
 *
 * @module retry
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Base delay in milliseconds (doubles each retry) */
  baseDelayMs: number
  /** Maximum delay in milliseconds (cap for exponential growth) */
  maxDelayMs: number
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number
}

/**
 * Result from a retryable operation
 */
export interface RetryResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean
  /** Number of retry attempts made */
  retryCount: number
  /** Result data if successful */
  data?: T
  /** Error if failed */
  error?: Error
}

/**
 * Error with optional HTTP status code and retry-after header
 */
export interface RetryableError {
  statusCode?: number
  message: string
  retryAfter?: number // seconds
}

// =============================================================================
// Constants
// =============================================================================

/**
 * HTTP status codes that indicate transient failures worth retrying
 */
const RETRYABLE_STATUS_CODES = new Set([
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
])

/**
 * Default retry configuration per spec (1s→2s→4s with jitter)
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterFactor: 0.1,
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Calculate exponential backoff delay for a retry attempt.
 *
 * @param attempt - Zero-indexed retry attempt number
 * @param options - Backoff configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  options: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'jitterFactor'>
): number {
  const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs)

  if (options.jitterFactor > 0) {
    const jitterRange = cappedDelay * options.jitterFactor
    const jitter = (Math.random() * 2 - 1) * jitterRange
    return Math.round(cappedDelay + jitter)
  }

  return cappedDelay
}

/**
 * Determine if an error is worth retrying.
 *
 * @param statusCode - HTTP status code (undefined for network errors)
 * @returns true if the error is transient and worth retrying
 */
export function isRetryableError(statusCode: number | undefined): boolean {
  // Network errors (no status code) are retryable
  if (statusCode === undefined) {
    return true
  }

  return RETRYABLE_STATUS_CODES.has(statusCode)
}

/**
 * Execute an operation with retry logic.
 *
 * Implements exponential backoff with jitter. Respects Retry-After headers.
 * Non-retryable errors (4xx except 429) fail immediately.
 *
 * @param operation - Async operation to retry
 * @param options - Retry configuration
 * @returns Result with success status and retry count
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<RetryResult<T>> {
  let lastError: Error | undefined
  let retryCount = 0

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      const result = await operation()
      return {
        success: true,
        retryCount,
        data: result,
      }
    } catch (error) {
      const retryableError = error as RetryableError
      lastError = new Error(retryableError.message)

      if (!isRetryableError(retryableError.statusCode)) {
        return {
          success: false,
          retryCount: 0,
          error: lastError,
        }
      }

      if (attempt === options.maxRetries) {
        return {
          success: false,
          retryCount,
          error: new Error(
            `Operation failed after ${retryCount} retries: ${retryableError.message}`
          ),
        }
      }

      let delayMs: number
      if (retryableError.retryAfter !== undefined && retryableError.retryAfter > 0) {
        delayMs = retryableError.retryAfter * 1000 // Convert seconds to ms
      } else {
        delayMs = calculateBackoffDelay(attempt, options)
      }

      await sleep(delayMs)
      retryCount++
    }
  }

  return {
    success: false,
    retryCount,
    error: lastError ?? new Error('Unknown error'),
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
