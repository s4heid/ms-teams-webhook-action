/**
 * Authentication service tests for MS Teams Webhook Notification Action
 * Tests OAuth2 token acquisition flow.
 */

import { describe, it, expect } from '@jest/globals'
import { getAccessToken } from '../src/auth.js'
import type { IHttpClient, HttpClientFactory } from '../src/auth.js'
import { AuthenticationError } from '../src/types.js'

/**
 * Creates a mock HTTP client factory for testing.
 */
function createMockHttpClientFactory(
  mockPost: IHttpClient['post']
): HttpClientFactory {
  return () => ({ post: mockPost })
}

describe('getAccessToken', () => {
  const validCredentials = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    tenantId: 'test-tenant-id',
  }

  describe('successful token acquisition', () => {
    it('should return access token on successful authentication', async () => {
      const mockResponse = {
        token_type: 'Bearer',
        expires_in: 3599,
        access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...',
      }

      const mockPost = async () => ({
        message: { statusCode: 200 },
        readBody: async () => JSON.stringify(mockResponse),
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      const result = await getAccessToken(validCredentials, factory)

      expect(result.accessToken).toBe(mockResponse.access_token)
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('should POST to correct Microsoft token endpoint', async () => {
      let capturedUrl = ''
      let capturedHeaders: Record<string, string> = {}

      const mockPost = async (url: string, _data: string, headers: Record<string, string>) => {
        capturedUrl = url
        capturedHeaders = headers
        return {
          message: { statusCode: 200 },
          readBody: async () => JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3599,
            access_token: 'test-token',
          }),
        }
      }

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await getAccessToken(validCredentials, factory)

      expect(capturedUrl).toBe(
        `https://login.microsoftonline.com/${validCredentials.tenantId}/oauth2/v2.0/token`
      )
      expect(capturedHeaders['Content-Type']).toBe('application/x-www-form-urlencoded')
    })

    it('should include correct grant_type and scope in request body', async () => {
      let capturedBody = ''

      const mockPost = async (_url: string, data: string) => {
        capturedBody = data
        return {
          message: { statusCode: 200 },
          readBody: async () => JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3599,
            access_token: 'test-token',
          }),
        }
      }

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await getAccessToken(validCredentials, factory)

      expect(capturedBody).toContain('grant_type=client_credentials')
      expect(capturedBody).toContain('scope=https%3A%2F%2Fservice.flow.microsoft.com%2F%2F.default')
      expect(capturedBody).toContain(`client_id=${validCredentials.clientId}`)
      expect(capturedBody).toContain(`client_secret=${validCredentials.clientSecret}`)
    })
  })

  describe('error handling', () => {
    it('should throw AuthenticationError for invalid_client error', async () => {
      const mockPost = async () => ({
        message: { statusCode: 401 },
        readBody: async () => JSON.stringify({
          error: 'invalid_client',
          error_description: 'AADSTS7000215: Invalid client secret provided.',
          correlation_id: 'test-correlation-id',
        }),
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await expect(getAccessToken(validCredentials, factory)).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError for tenant_not_found error', async () => {
      const mockPost = async () => ({
        message: { statusCode: 400 },
        readBody: async () => JSON.stringify({
          error: 'invalid_request',
          error_description: "AADSTS90002: Tenant 'invalid-tenant' not found.",
          correlation_id: 'test-correlation-id',
        }),
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await expect(getAccessToken(validCredentials, factory)).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError for unauthorized_client error', async () => {
      const mockPost = async () => ({
        message: { statusCode: 401 },
        readBody: async () => JSON.stringify({
          error: 'unauthorized_client',
          error_description: 'AADSTS700016: Application with identifier not found.',
          correlation_id: 'test-correlation-id',
        }),
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await expect(getAccessToken(validCredentials, factory)).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError for invalid_grant error', async () => {
      const mockPost = async () => ({
        message: { statusCode: 400 },
        readBody: async () => JSON.stringify({
          error: 'invalid_grant',
          error_description: 'AADSTS70011: The provided value for the input parameter scope is not valid.',
          correlation_id: 'test-correlation-id',
        }),
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await expect(getAccessToken(validCredentials, factory)).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError for malformed token response', async () => {
      const mockPost = async () => ({
        message: { statusCode: 200 },
        readBody: async () => 'not valid json',
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await expect(getAccessToken(validCredentials, factory)).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError when access_token is missing', async () => {
      const mockPost = async () => ({
        message: { statusCode: 200 },
        readBody: async () => JSON.stringify({
          token_type: 'Bearer',
          expires_in: 3599,
          // access_token is missing
        }),
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      await expect(getAccessToken(validCredentials, factory)).rejects.toThrow(AuthenticationError)
    })

    it('should include correlation_id in error when available', async () => {
      const correlationId = 'test-correlation-id-123'
      const mockPost = async () => ({
        message: { statusCode: 401 },
        readBody: async () => JSON.stringify({
          error: 'invalid_client',
          error_description: 'Invalid credentials',
          correlation_id: correlationId,
        }),
      })

      const factory = createMockHttpClientFactory(mockPost as IHttpClient['post'])
      
      let caughtError: AuthenticationError | undefined
      try {
        await getAccessToken(validCredentials, factory)
      } catch (error) {
        caughtError = error as AuthenticationError
      }

      expect(caughtError).toBeInstanceOf(AuthenticationError)
      expect(caughtError?.correlationId).toBe(correlationId)
    })
  })
})
