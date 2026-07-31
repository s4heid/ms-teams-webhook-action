/**
 * Notification service tests for MS Teams Webhook Notification Action
 * Tests webhook POST delivery.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals'
import { sendNotification, sendNotificationWithRetry } from '../src/notify.js'
import type { IHttpClient, HttpClientFactory } from '../src/notify.js'

/**
 * Creates a mock HTTP client factory for testing.
 */
function createMockHttpClientFactory(
  mockPost: IHttpClient['post']
): HttpClientFactory {
  return () => ({ post: mockPost })
}

describe('sendNotification', () => {
  const validParams = {
    webhookUrl: 'https://prod-00.westus.logic.azure.com/workflows/...',
    accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...',
    payload: { message: 'Build successful' },
    timeout: 10000,
  }

  describe('successful notification', () => {
    it('should return success for HTTP 202 response', async () => {
      const mockPost = async () => ({
        message: { statusCode: 202 },
        readBody: async () => '',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotification(validParams, factory)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(202)
      expect(result.retryCount).toBe(0)
    })

    it('should POST to webhook URL with Bearer token', async () => {
      let capturedUrl = ''
      let capturedData = ''
      let capturedHeaders: Record<string, string> = {}

      const mockPost = async (
        url: string,
        data: string,
        headers: Record<string, string>
      ) => {
        capturedUrl = url
        capturedData = data
        capturedHeaders = headers
        return {
          message: { statusCode: 202 },
          readBody: async () => '',
        }
      }

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      await sendNotification(validParams, factory)

      expect(capturedUrl).toBe(validParams.webhookUrl)
      expect(capturedData).toBe(JSON.stringify(validParams.payload))
      expect(capturedHeaders['Authorization']).toBe(
        `Bearer ${validParams.accessToken}`
      )
      expect(capturedHeaders['Content-Type']).toBe('application/json')
    })

    it('should include duration in result', async () => {
      const mockPost = async () => ({
        message: { statusCode: 202 },
        readBody: async () => '',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotification(validParams, factory)

      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(typeof result.durationMs).toBe('number')
    })

    it('should handle HTTP 200 as success', async () => {
      const mockPost = async () => ({
        message: { statusCode: 200 },
        readBody: async () => '',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotification(validParams, factory)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should return failure for HTTP 401', async () => {
      const mockPost = async () => ({
        message: { statusCode: 401 },
        readBody: async () => 'Unauthorized',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotification(validParams, factory)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(401)
      expect(result.error).toBeDefined()
    })

    it('should return failure for HTTP 500', async () => {
      const mockPost = async () => ({
        message: { statusCode: 500 },
        readBody: async () => 'Internal Server Error',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotification(validParams, factory)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.error).toBeDefined()
    })

    it('should handle network errors', async () => {
      const mockPost = async () => {
        throw new Error('ECONNREFUSED')
      }

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotification(validParams, factory)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('ECONNREFUSED')
    })

    it('should handle timeout errors', async () => {
      const mockPost = async () => {
        throw new Error('socket timeout')
      }

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotification(validParams, factory)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('socket timeout')
    })
  })
})

describe('sendNotificationWithRetry', () => {
  const validParams = {
    webhookUrl: 'https://prod-00.westus.logic.azure.com/workflows/...',
    accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...',
    payload: { message: 'Build successful' },
    timeout: 10000,
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('retry on transient errors', () => {
    it('should retry on HTTP 503 and succeed on second attempt', async () => {
      let callCount = 0
      const mockPost = async () => {
        callCount++
        if (callCount === 1) {
          return {
            message: { statusCode: 503 },
            readBody: async () => 'Service Unavailable',
          }
        }
        return {
          message: { statusCode: 202 },
          readBody: async () => '',
        }
      }

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const promise = sendNotificationWithRetry(
        { ...validParams, retryOptions: { baseDelayMs: 100, jitterFactor: 0 } },
        factory
      )

      // Advance past retry delay
      await jest.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(1)
    })

    it('should retry on HTTP 429 rate limit', async () => {
      let callCount = 0
      const mockPost = async () => {
        callCount++
        if (callCount === 1) {
          return {
            message: { statusCode: 429 },
            readBody: async () => 'Rate Limited',
          }
        }
        return {
          message: { statusCode: 202 },
          readBody: async () => '',
        }
      }

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const promise = sendNotificationWithRetry(
        { ...validParams, retryOptions: { baseDelayMs: 50, jitterFactor: 0 } },
        factory
      )

      await jest.advanceTimersByTimeAsync(50)

      const result = await promise
      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(1)
    })
  })

  describe('no retry on client errors', () => {
    it('should NOT retry on HTTP 401 Unauthorized', async () => {
      const mockPost = async () => ({
        message: { statusCode: 401 },
        readBody: async () => 'Unauthorized',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotificationWithRetry(validParams, factory)

      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(0)
    })

    it('should NOT retry on HTTP 400 Bad Request', async () => {
      const mockPost = async () => ({
        message: { statusCode: 400 },
        readBody: async () => 'Bad Request',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotificationWithRetry(validParams, factory)

      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(0)
    })
  })

  describe('immediate success', () => {
    it('should return immediately with retryCount: 0 on first success', async () => {
      const mockPost = async () => ({
        message: { statusCode: 202 },
        readBody: async () => '',
      })

      const factory = createMockHttpClientFactory(
        mockPost as IHttpClient['post']
      )
      const result = await sendNotificationWithRetry(validParams, factory)

      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(0)
      expect(result.statusCode).toBe(202)
    })
  })
})
