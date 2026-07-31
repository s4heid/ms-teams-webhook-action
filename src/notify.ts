/**
 * Notification Delivery Service for MS Teams Webhook Notification Action
 * Handles sending notifications to Power Automate webhooks.
 */

import { HttpClient } from '@actions/http-client'
import type { HttpClientResponse } from '@actions/http-client'
import { NotifyResult, NotificationPayload } from './types.js'
import {
  withRetry,
  isRetryableError,
  DEFAULT_RETRY_OPTIONS,
  RetryOptions,
} from './retry.js'

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
export type HttpClientFactory = (timeout: number) => IHttpClient

/**
 * Default HTTP client factory.
 */
const defaultHttpClientFactory: HttpClientFactory = (timeout: number) =>
  new HttpClient('ms-teams-webhook-action', undefined, {
    socketTimeout: timeout,
  })

/**
 * Parameters for sending a notification.
 */
export interface NotifyParams {
  webhookUrl: string
  accessToken: string
  payload: NotificationPayload
  timeout: number
}

/**
 * Success status codes per spec (FR-009: HTTP 202 is success).
 */
const SUCCESS_STATUS_CODES = [200, 201, 202, 204]

/**
 * Sends a notification to the Power Automate webhook.
 *
 * @param params - Notification parameters
 * @param httpClientFactory - Optional factory for creating HTTP client (for testing)
 * @returns NotifyResult with success status and metadata
 */
export async function sendNotification(
  params: NotifyParams,
  httpClientFactory: HttpClientFactory = defaultHttpClientFactory
): Promise<NotifyResult> {
  const startTime = Date.now()
  const httpClient = httpClientFactory(params.timeout)

  try {
    const response = await httpClient.post(
      params.webhookUrl,
      JSON.stringify(params.payload),
      {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    )

    const statusCode = response.message.statusCode ?? 0
    const durationMs = Date.now() - startTime
    const success = SUCCESS_STATUS_CODES.includes(statusCode)

    if (success) {
      return {
        success: true,
        statusCode,
        retryCount: 0,
        durationMs,
      }
    }

    const responseBody = await response.readBody()
    return {
      success: false,
      statusCode,
      retryCount: 0,
      durationMs,
      error: new Error(
        `Notification failed with status ${statusCode}: ${responseBody}`
      ),
    }
  } catch (error) {
    const durationMs = Date.now() - startTime

    return {
      success: false,
      statusCode: 0,
      retryCount: 0,
      durationMs,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Extended notification parameters with retry support.
 */
export interface NotifyWithRetryParams extends NotifyParams {
  /** Retry configuration (uses defaults if not specified) */
  retryOptions?: Partial<RetryOptions>
}

/**
 * Error thrown during notification for retry handling.
 */
interface NotifyError extends Error {
  statusCode?: number
  retryAfter?: number
}

/**
 * Sends a notification with automatic retry on transient failures.
 *
 * Implements exponential backoff (1s→2s→4s) with jitter.
 * Retries on: 429, 500, 502, 503, 504, network errors.
 * Does NOT retry on: 400, 401, 403, 404.
 *
 * @param params - Notification parameters with optional retry config
 * @param httpClientFactory - Optional factory for creating HTTP client (for testing)
 * @returns NotifyResult with success status, retry count, and metadata
 */
export async function sendNotificationWithRetry(
  params: NotifyWithRetryParams,
  httpClientFactory: HttpClientFactory = defaultHttpClientFactory
): Promise<NotifyResult> {
  const startTime = Date.now()

  const retryOptions: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...params.retryOptions,
  }

  const operation = async (): Promise<NotifyResult> => {
    const result = await sendNotification(params, httpClientFactory)

    if (result.success) {
      return result
    }

    if (isRetryableError(result.statusCode)) {
      const error: NotifyError = new Error(
        result.error?.message ?? 'Request failed'
      )
      error.statusCode = result.statusCode
      throw error
    }

    return result
  }

  const retryResult = await withRetry(operation, retryOptions)

  const durationMs = Date.now() - startTime

  if (retryResult.success && retryResult.data) {
    return {
      ...retryResult.data,
      retryCount: retryResult.retryCount,
      durationMs,
    }
  }

  return {
    success: false,
    statusCode: 0,
    retryCount: retryResult.retryCount,
    durationMs,
    error: retryResult.error,
  }
}
