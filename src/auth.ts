/**
 * OAuth2 Authentication Service for MS Teams Webhook Notification Action
 * Handles token acquisition from Microsoft Identity Platform.
 */

import { HttpClient } from '@actions/http-client'
import type { HttpClientResponse } from '@actions/http-client'
import {
  AuthResult,
  TokenResponse,
  TokenErrorResponse,
  AuthenticationError,
} from './types.js'

/**
 * Authentication credentials for Azure AD.
 */
export interface AuthCredentials {
  clientId: string
  clientSecret: string
  tenantId: string
}

/**
 * HTTP client interface for dependency injection.
 */
export interface IHttpClient {
  post(
    url: string,
    data: string,
    headers: Record<string, string>
  ): Promise<HttpClientResponse>
}

/**
 * Factory type for creating HTTP clients.
 */
export type HttpClientFactory = () => IHttpClient

/**
 * Default HTTP client factory.
 */
const defaultHttpClientFactory: HttpClientFactory = () =>
  new HttpClient('ms-teams-webhook-action')

/**
 * Microsoft token endpoint URL template.
 */
const TOKEN_ENDPOINT_TEMPLATE =
  'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token'

/**
 * Scope for Power Automate/Flow API.
 */
const FLOW_SCOPE = 'https://service.flow.microsoft.com//.default'

/**
 * Maps Microsoft error codes to user-friendly messages.
 * Per US2 acceptance scenarios.
 */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_client:
    'Authentication failed: Invalid client credentials. Verify CLIENT_SECRET is correct.',
  unauthorized_client:
    'Authentication failed: Application not found or disabled. Verify CLIENT_ID and app registration status.',
  invalid_grant:
    'Authentication failed: Invalid grant. Verify application permissions.',
  invalid_request:
    'Authentication failed: Tenant not found. Verify TENANT_ID is correct.',
}

/**
 * Gets an access token from Microsoft Identity Platform.
 *
 * @param credentials - Azure AD application credentials
 * @param httpClientFactory - Optional factory for creating HTTP client (for testing)
 * @returns AuthResult containing the access token and expiration
 * @throws AuthenticationError if authentication fails
 */
export async function getAccessToken(
  credentials: AuthCredentials,
  httpClientFactory: HttpClientFactory = defaultHttpClientFactory
): Promise<AuthResult> {
  const tokenUrl = TOKEN_ENDPOINT_TEMPLATE.replace(
    '{tenantId}',
    credentials.tenantId
  )

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    grant_type: 'client_credentials',
    scope: FLOW_SCOPE,
  }).toString()

  const httpClient = httpClientFactory()

  try {
    const response = await httpClient.post(tokenUrl, body, {
      'Content-Type': 'application/x-www-form-urlencoded',
    })

    const responseBody = await response.readBody()
    const statusCode = response.message.statusCode ?? 0

    if (statusCode !== 200) {
      return handleErrorResponse(responseBody, statusCode)
    }

    return parseTokenResponse(responseBody)
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    throw new AuthenticationError(
      `Authentication failed: Network error - ${(error as Error).message}`,
      'network_error'
    )
  }
}

/**
 * Parses a successful token response.
 *
 * @param responseBody - Raw JSON response body
 * @returns AuthResult with token and expiration
 * @throws AuthenticationError if response is malformed
 */
function parseTokenResponse(responseBody: string): AuthResult {
  let parsed: TokenResponse

  try {
    parsed = JSON.parse(responseBody) as TokenResponse
  } catch {
    throw new AuthenticationError(
      'Authentication failed: Invalid token response format',
      'invalid_response'
    )
  }

  if (!parsed.access_token) {
    throw new AuthenticationError(
      'Authentication failed: Invalid token response format',
      'invalid_response'
    )
  }

  // Calculate expiration time (default to 1 hour if not provided)
  const expiresInSeconds = parsed.expires_in ?? 3600
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

  return {
    accessToken: parsed.access_token,
    expiresAt,
  }
}

/**
 * Handles error responses from the token endpoint.
 *
 * @param responseBody - Raw JSON error response body
 * @param statusCode - HTTP status code
 * @throws AuthenticationError with actionable message
 */
function handleErrorResponse(responseBody: string, statusCode: number): never {
  let errorResponse: TokenErrorResponse

  try {
    errorResponse = JSON.parse(responseBody) as TokenErrorResponse
  } catch {
    throw new AuthenticationError(
      `Authentication failed: HTTP ${statusCode}`,
      'unknown_error'
    )
  }

  const errorCode = errorResponse.error
  const message =
    ERROR_MESSAGES[errorCode] ??
    `Authentication failed: ${errorResponse.error_description || errorCode}`

  throw new AuthenticationError(
    message,
    errorCode,
    errorResponse.correlation_id
  )
}
