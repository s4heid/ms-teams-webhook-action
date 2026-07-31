/**
 * Main integration tests for MS Teams Webhook Notification Action
 * Tests the complete notification flow.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Create mocks before any imports
const mockGetInput = jest.fn<(name: string) => string>()
const mockSetSecret = jest.fn()
const mockSetOutput = jest.fn()
const mockSetFailed = jest.fn()
const mockInfo = jest.fn()
const mockWarning = jest.fn()

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  setSecret: mockSetSecret,
  setOutput: mockSetOutput,
  setFailed: mockSetFailed,
  info: mockInfo,
  warning: mockWarning,
}))

// Mock HTTP client for both auth and notify
const mockPost = jest.fn<() => Promise<unknown>>()
jest.unstable_mockModule('@actions/http-client', () => ({
  HttpClient: jest.fn(() => ({
    post: mockPost,
  })),
}))

// Import after mocking
const { run } = await import('../src/main.js')

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPost.mockReset()

    // Default mock implementations
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        tenant_id: 'test-tenant-id',
        webhook_url: 'https://prod-00.westus.logic.azure.com/workflows/test',
        body: '{"message": "Test notification"}',
        dry_run: 'false',
        fail_on_error: 'false',
        timeout: '10000',
      }
      return inputs[name] || ''
    })
  })

  describe('successful notification flow', () => {
    // Note: Full integration tests require more complex mocking setup
    // These tests verify the auth and notify services are called correctly
    // The unit tests in auth.test.ts and notify.test.ts cover the core logic

    it('should mask client_secret before any processing', async () => {
      mockPost.mockResolvedValueOnce({
        message: { statusCode: 200 },
        readBody: jest.fn<() => Promise<string>>().mockResolvedValue(
          JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3599,
            access_token: 'test-token',
          })
        ),
      })

      mockPost.mockResolvedValueOnce({
        message: { statusCode: 202 },
        readBody: jest.fn<() => Promise<string>>().mockResolvedValue(''),
      })

      await run()

      expect(mockSetSecret).toHaveBeenCalledWith('test-client-secret')
    })

    it('should include duration_ms in outputs', async () => {
      mockPost.mockResolvedValueOnce({
        message: { statusCode: 200 },
        readBody: jest.fn<() => Promise<string>>().mockResolvedValue(
          JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3599,
            access_token: 'test-token',
          })
        ),
      })

      mockPost.mockResolvedValueOnce({
        message: { statusCode: 202 },
        readBody: jest.fn<() => Promise<string>>().mockResolvedValue(''),
      })

      await run()

      expect(mockSetOutput).toHaveBeenCalledWith(
        'duration_ms',
        expect.any(String)
      )
    })
  })

  describe('dry-run mode', () => {
    it('should not make HTTP calls when dry_run is true', async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          tenant_id: 'test-tenant-id',
          webhook_url: 'https://example.com/webhook',
          body: '{"message": "Test"}',
          dry_run: 'true',
          fail_on_error: 'false',
          timeout: '10000',
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockPost).not.toHaveBeenCalled()
      expect(mockSetOutput).toHaveBeenCalledWith('skip_reason', 'dry_run')
    })

    it('should set notification_sent to false in dry-run', async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          tenant_id: 'test-tenant-id',
          webhook_url: 'https://example.com/webhook',
          body: '{"message": "Test"}',
          dry_run: 'true',
          fail_on_error: 'false',
          timeout: '10000',
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockSetOutput).toHaveBeenCalledWith('notification_sent', 'false')
    })
  })

  describe('validation errors', () => {
    it('should fail when webhook_url is not HTTPS', async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          tenant_id: 'test-tenant-id',
          webhook_url: 'http://insecure.example.com/webhook',
          body: '{"message": "Test"}',
          dry_run: 'false',
          fail_on_error: 'true',
          timeout: '10000',
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith(
        expect.stringContaining('HTTPS')
      )
    })

    it('should fail when body is invalid JSON', async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          tenant_id: 'test-tenant-id',
          webhook_url: 'https://example.com/webhook',
          body: 'not valid json',
          dry_run: 'false',
          fail_on_error: 'true',
          timeout: '10000',
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith(
        expect.stringContaining('JSON')
      )
    })
  })
})
