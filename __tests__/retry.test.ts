/**
 * Retry logic tests for MS Teams Webhook Action
 * Tests for User Story 4 - Retry on Transient Network Failures
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
  withRetry,
  calculateBackoffDelay,
  isRetryableError,
  RetryOptions,
  DEFAULT_RETRY_OPTIONS,
} from '../src/retry.js'

describe('calculateBackoffDelay', () => {
  it('should calculate exponential backoff: 1s, 2s, 4s', () => {
    const options = { baseDelayMs: 1000, maxDelayMs: 10000, jitterFactor: 0 }

    expect(calculateBackoffDelay(0, options)).toBe(1000) // 1s * 2^0 = 1s
    expect(calculateBackoffDelay(1, options)).toBe(2000) // 1s * 2^1 = 2s
    expect(calculateBackoffDelay(2, options)).toBe(4000) // 1s * 2^2 = 4s
    expect(calculateBackoffDelay(3, options)).toBe(8000) // 1s * 2^3 = 8s
  })

  it('should cap delay at maxDelayMs', () => {
    const options = { baseDelayMs: 1000, maxDelayMs: 5000, jitterFactor: 0 }

    expect(calculateBackoffDelay(5, options)).toBe(5000) // Capped at 5s
  })

  it('should add jitter when jitterFactor > 0', () => {
    const options = { baseDelayMs: 1000, maxDelayMs: 10000, jitterFactor: 0.1 }

    // Run multiple times to ensure jitter is applied
    const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(0, options))

    // With jitter, all delays should be between 900ms and 1100ms (±10%)
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(900)
      expect(delay).toBeLessThanOrEqual(1100)
    })
  })
})

describe('isRetryableError', () => {
  it('should return true for HTTP 429 (rate limit)', () => {
    expect(isRetryableError(429)).toBe(true)
  })

  it('should return true for HTTP 500 (server error)', () => {
    expect(isRetryableError(500)).toBe(true)
  })

  it('should return true for HTTP 502 (bad gateway)', () => {
    expect(isRetryableError(502)).toBe(true)
  })

  it('should return true for HTTP 503 (service unavailable)', () => {
    expect(isRetryableError(503)).toBe(true)
  })

  it('should return true for HTTP 504 (gateway timeout)', () => {
    expect(isRetryableError(504)).toBe(true)
  })

  it('should return false for HTTP 400 (bad request)', () => {
    expect(isRetryableError(400)).toBe(false)
  })

  it('should return false for HTTP 401 (unauthorized)', () => {
    expect(isRetryableError(401)).toBe(false)
  })

  it('should return false for HTTP 403 (forbidden)', () => {
    expect(isRetryableError(403)).toBe(false)
  })

  it('should return false for HTTP 404 (not found)', () => {
    expect(isRetryableError(404)).toBe(false)
  })

  it('should return true for network errors (no status code)', () => {
    expect(isRetryableError(undefined)).toBe(true)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('success after failure (T043)', () => {
    it('should succeed after transient failure', async () => {
      let callCount = 0
      const operation = jest.fn(async () => {
        callCount++
        if (callCount === 1) {
          throw { statusCode: 503, message: 'Service Unavailable' }
        }
        return { success: true, data: 'ok' }
      })

      const options: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterFactor: 0,
      }

      const promise = withRetry(operation, options)

      // Fast-forward past first retry delay
      await jest.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(1)
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should return retry_count: 1 after one retry', async () => {
      let callCount = 0
      const operation = jest.fn(async () => {
        callCount++
        if (callCount === 1) {
          throw { statusCode: 500, message: 'Internal Server Error' }
        }
        return { success: true }
      })

      const options: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 50,
        maxDelayMs: 500,
        jitterFactor: 0,
      }

      const promise = withRetry(operation, options)
      await jest.advanceTimersByTimeAsync(50)

      const result = await promise
      expect(result.retryCount).toBe(1)
    })
  })

  describe('max retries exhausted (T044)', () => {
    it('should fail after exhausting all retries', async () => {
      const operation = jest.fn(async () => {
        throw { statusCode: 503, message: 'Service Unavailable' }
      })

      const options: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 50,
        maxDelayMs: 500,
        jitterFactor: 0,
      }

      const promise = withRetry(operation, options)

      // Advance through all retry delays: 50ms, 100ms, 200ms
      await jest.advanceTimersByTimeAsync(50) // retry 1
      await jest.advanceTimersByTimeAsync(100) // retry 2
      await jest.advanceTimersByTimeAsync(200) // retry 3

      const result = await promise
      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(3)
      expect(result.error?.message).toContain('after 3 retries')
      expect(operation).toHaveBeenCalledTimes(4) // initial + 3 retries
    })
  })

  describe('non-retryable errors', () => {
    it('should not retry on 401 Unauthorized', async () => {
      const operation = jest.fn(async () => {
        throw { statusCode: 401, message: 'Unauthorized' }
      })

      const options: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterFactor: 0,
      }

      const result = await withRetry(operation, options)

      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(0)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 400 Bad Request', async () => {
      const operation = jest.fn(async () => {
        throw { statusCode: 400, message: 'Bad Request' }
      })

      const result = await withRetry(operation, DEFAULT_RETRY_OPTIONS)

      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(0)
    })
  })

  describe('immediate success', () => {
    it('should return immediately on first success with retryCount: 0', async () => {
      const operation = jest.fn(async () => ({ success: true, data: 'ok' }))

      const result = await withRetry(operation, DEFAULT_RETRY_OPTIONS)

      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(0)
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Retry-After header support (T051)', () => {
    it('should respect Retry-After header in seconds', async () => {
      let callCount = 0
      const operation = jest.fn(async () => {
        callCount++
        if (callCount === 1) {
          throw { statusCode: 429, message: 'Rate Limited', retryAfter: 5 }
        }
        return { success: true }
      })

      const options: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        jitterFactor: 0,
      }

      const promise = withRetry(operation, options)

      // Should wait 5000ms (5 seconds) per Retry-After
      await jest.advanceTimersByTimeAsync(5000)

      const result = await promise
      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(1)
    })
  })
})

describe('DEFAULT_RETRY_OPTIONS', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3)
    expect(DEFAULT_RETRY_OPTIONS.baseDelayMs).toBe(1000)
    expect(DEFAULT_RETRY_OPTIONS.maxDelayMs).toBe(10000)
    expect(DEFAULT_RETRY_OPTIONS.jitterFactor).toBeGreaterThan(0)
  })
})
