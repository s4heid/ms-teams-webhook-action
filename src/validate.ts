/**
 * Input validation for MS Teams Webhook Notification Action
 * Validates all inputs before any network activity occurs.
 */

import { ActionInputs, ValidationError } from './types.js'

/**
 * Validates that all required inputs are present and non-empty.
 * @throws ValidationError if any required input is missing
 */
export function validateRequiredInputs(inputs: Partial<ActionInputs>): void {
  const requiredFields = [
    'client_id',
    'client_secret',
    'tenant_id',
    'webhook_url',
  ] as const

  for (const field of requiredFields) {
    const value = inputs[field]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      throw new ValidationError(`Missing required input: ${field}`, field)
    }
  }
}

/**
 * Validates that the webhook URL uses HTTPS.
 * Per FR-015: Action MUST validate webhook URL uses HTTPS scheme.
 * @throws ValidationError if URL is invalid or not HTTPS
 */
export function validateWebhookUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ValidationError('Webhook URL must be a valid URL', 'webhook_url')
  }

  if (parsed.protocol !== 'https:') {
    throw new ValidationError('Webhook URL must use HTTPS', 'webhook_url')
  }
}

/**
 * Validates that the body is valid JSON if provided.
 * @throws ValidationError if body is not valid JSON
 */
export function validateJsonBody(body: string | undefined): void {
  if (!body) {
    return
  }

  try {
    JSON.parse(body)
  } catch {
    throw new ValidationError('Invalid body: malformed JSON', 'body')
  }
}

/**
 * Validates that either body or convenience parameters are provided.
 * Per FR-011: Action MUST require either body OR convenience parameters.
 * @throws ValidationError if neither body nor convenience params are present
 */
export function validateMessageContent(inputs: Partial<ActionInputs>): void {
  const hasBody = inputs.body && inputs.body.trim() !== ''
  const hasConvenience = inputs.status || inputs.title || inputs.summary

  if (!hasBody && !hasConvenience) {
    throw new ValidationError(
      'Either body or convenience parameters (status, title) must be provided',
      'body'
    )
  }
}

/**
 * Validates the status value if provided.
 * @throws ValidationError if status is not a valid value
 */
export function validateStatus(
  status: string | undefined
): asserts status is 'success' | 'failure' | 'cancelled' | undefined {
  if (!status) {
    return
  }

  const validStatuses = ['success', 'failure', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new ValidationError(
      `Invalid status: must be one of ${validStatuses.join(', ')}`,
      'status'
    )
  }
}

/**
 * Validates timeout value if provided.
 * @throws ValidationError if timeout is not a valid positive number
 */
export function validateTimeout(timeout: number | undefined): void {
  if (timeout === undefined) {
    return
  }

  if (typeof timeout !== 'number' || isNaN(timeout) || timeout <= 0) {
    throw new ValidationError(
      'Timeout must be a positive number in milliseconds',
      'timeout'
    )
  }

  // Max timeout of 30 seconds
  if (timeout > 30000) {
    throw new ValidationError(
      'Timeout cannot exceed 30000ms (30 seconds)',
      'timeout'
    )
  }
}

/**
 * Validates the payload size does not exceed Teams limits.
 * Per spec: ~28KB limit for Adaptive Cards.
 * @throws ValidationError if payload exceeds size limit
 */
export function validatePayloadSize(payload: string): void {
  const MAX_PAYLOAD_SIZE = 28 * 1024 // 28KB

  const size = Buffer.byteLength(payload, 'utf8')
  if (size > MAX_PAYLOAD_SIZE) {
    throw new ValidationError(
      'Message body exceeds maximum size (28KB for Adaptive Cards)',
      'body'
    )
  }
}

/**
 * Performs all input validations.
 * @throws ValidationError if any validation fails
 */
export function validateAllInputs(inputs: Partial<ActionInputs>): void {
  validateRequiredInputs(inputs)
  validateWebhookUrl(inputs.webhook_url!)
  validateJsonBody(inputs.body)
  validateMessageContent(inputs)
  validateStatus(inputs.status)
  validateTimeout(inputs.timeout)
}
