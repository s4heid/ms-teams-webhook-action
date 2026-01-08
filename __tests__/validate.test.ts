/**
 * Validation tests for MS Teams Webhook Notification Action
 */

import { describe, it, expect } from '@jest/globals'
import {
  validateRequiredInputs,
  validateWebhookUrl,
  validateJsonBody,
  validateMessageContent,
  validateStatus,
  validateTimeout,
  validatePayloadSize,
  validateAllInputs,
} from '../src/validate.js'
import { ValidationError } from '../src/types.js'

describe('validateRequiredInputs', () => {
  it('should pass when all required inputs are present', () => {
    const inputs = {
      client_id: 'test-client-id',
      client_secret: 'test-secret',
      tenant_id: 'test-tenant',
      webhook_url: 'https://example.com/webhook',
    }

    expect(() => validateRequiredInputs(inputs)).not.toThrow()
  })

  it('should throw ValidationError when client_id is missing', () => {
    const inputs = {
      client_secret: 'test-secret',
      tenant_id: 'test-tenant',
      webhook_url: 'https://example.com/webhook',
    }

    expect(() => validateRequiredInputs(inputs)).toThrow(ValidationError)
    expect(() => validateRequiredInputs(inputs)).toThrow(
      'Missing required input: client_id'
    )
  })

  it('should throw ValidationError when client_secret is empty string', () => {
    const inputs = {
      client_id: 'test-client-id',
      client_secret: '   ',
      tenant_id: 'test-tenant',
      webhook_url: 'https://example.com/webhook',
    }

    expect(() => validateRequiredInputs(inputs)).toThrow(ValidationError)
    expect(() => validateRequiredInputs(inputs)).toThrow(
      'Missing required input: client_secret'
    )
  })

  it('should throw ValidationError when webhook_url is missing', () => {
    const inputs = {
      client_id: 'test-client-id',
      client_secret: 'test-secret',
      tenant_id: 'test-tenant',
    }

    expect(() => validateRequiredInputs(inputs)).toThrow(ValidationError)
    expect(() => validateRequiredInputs(inputs)).toThrow(
      'Missing required input: webhook_url'
    )
  })
})

describe('validateWebhookUrl', () => {
  it('should pass for valid HTTPS URL', () => {
    expect(() =>
      validateWebhookUrl('https://example.com/webhook')
    ).not.toThrow()
  })

  it('should pass for HTTPS URL with path and query', () => {
    expect(() =>
      validateWebhookUrl('https://example.com/api/webhook?sig=abc123')
    ).not.toThrow()
  })

  it('should throw ValidationError for HTTP URL', () => {
    expect(() => validateWebhookUrl('http://example.com/webhook')).toThrow(
      ValidationError
    )
    expect(() => validateWebhookUrl('http://example.com/webhook')).toThrow(
      'Webhook URL must use HTTPS'
    )
  })

  it('should throw ValidationError for invalid URL', () => {
    expect(() => validateWebhookUrl('not-a-valid-url')).toThrow(ValidationError)
    expect(() => validateWebhookUrl('not-a-valid-url')).toThrow(
      'Webhook URL must be a valid URL'
    )
  })

  it('should throw ValidationError for empty URL', () => {
    expect(() => validateWebhookUrl('')).toThrow(ValidationError)
  })
})

describe('validateJsonBody', () => {
  it('should pass for valid JSON', () => {
    expect(() => validateJsonBody('{"message": "test"}')).not.toThrow()
  })

  it('should pass for complex JSON', () => {
    const complexJson = JSON.stringify({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: [{ type: 'TextBlock', text: 'Hello' }],
    })
    expect(() => validateJsonBody(complexJson)).not.toThrow()
  })

  it('should pass for undefined body', () => {
    expect(() => validateJsonBody(undefined)).not.toThrow()
  })

  it('should throw ValidationError for malformed JSON', () => {
    expect(() => validateJsonBody('{not valid json}')).toThrow(ValidationError)
    expect(() => validateJsonBody('{not valid json}')).toThrow(
      'Invalid body: malformed JSON'
    )
  })

  it('should throw ValidationError for incomplete JSON', () => {
    expect(() => validateJsonBody('{"message":')).toThrow(ValidationError)
  })
})

describe('validateMessageContent', () => {
  it('should pass when body is provided', () => {
    const inputs = { body: '{"message": "test"}' }
    expect(() => validateMessageContent(inputs)).not.toThrow()
  })

  it('should pass when status is provided', () => {
    const inputs = { status: 'success' as const }
    expect(() => validateMessageContent(inputs)).not.toThrow()
  })

  it('should pass when title is provided', () => {
    const inputs = { title: 'Build Complete' }
    expect(() => validateMessageContent(inputs)).not.toThrow()
  })

  it('should throw ValidationError when neither body nor convenience params provided', () => {
    const inputs = {}
    expect(() => validateMessageContent(inputs)).toThrow(ValidationError)
    expect(() => validateMessageContent(inputs)).toThrow(
      'Either body or convenience parameters (status, title) must be provided'
    )
  })

  it('should throw ValidationError when body is empty string', () => {
    const inputs = { body: '   ' }
    expect(() => validateMessageContent(inputs)).toThrow(ValidationError)
  })
})

describe('validateStatus', () => {
  it('should pass for "success"', () => {
    expect(() => validateStatus('success')).not.toThrow()
  })

  it('should pass for "failure"', () => {
    expect(() => validateStatus('failure')).not.toThrow()
  })

  it('should pass for "cancelled"', () => {
    expect(() => validateStatus('cancelled')).not.toThrow()
  })

  it('should pass for undefined', () => {
    expect(() => validateStatus(undefined)).not.toThrow()
  })

  it('should throw ValidationError for invalid status', () => {
    expect(() => validateStatus('pending')).toThrow(ValidationError)
    expect(() => validateStatus('pending')).toThrow(
      'Invalid status: must be one of success, failure, cancelled'
    )
  })
})

describe('validateTimeout', () => {
  it('should pass for valid timeout', () => {
    expect(() => validateTimeout(10000)).not.toThrow()
  })

  it('should pass for undefined timeout', () => {
    expect(() => validateTimeout(undefined)).not.toThrow()
  })

  it('should throw ValidationError for negative timeout', () => {
    expect(() => validateTimeout(-1000)).toThrow(ValidationError)
    expect(() => validateTimeout(-1000)).toThrow(
      'Timeout must be a positive number in milliseconds'
    )
  })

  it('should throw ValidationError for zero timeout', () => {
    expect(() => validateTimeout(0)).toThrow(ValidationError)
  })

  it('should throw ValidationError for timeout exceeding 30 seconds', () => {
    expect(() => validateTimeout(60000)).toThrow(ValidationError)
    expect(() => validateTimeout(60000)).toThrow(
      'Timeout cannot exceed 30000ms (30 seconds)'
    )
  })
})

describe('validatePayloadSize', () => {
  it('should pass for small payload', () => {
    expect(() => validatePayloadSize('{"message": "test"}')).not.toThrow()
  })

  it('should throw ValidationError for payload exceeding 28KB', () => {
    const largePayload = 'x'.repeat(29 * 1024)
    expect(() => validatePayloadSize(largePayload)).toThrow(ValidationError)
    expect(() => validatePayloadSize(largePayload)).toThrow(
      'Message body exceeds maximum size (28KB for Adaptive Cards)'
    )
  })
})

describe('validateAllInputs', () => {
  it('should pass for valid complete inputs', () => {
    const inputs = {
      client_id: 'test-client-id',
      client_secret: 'test-secret',
      tenant_id: 'test-tenant',
      webhook_url: 'https://example.com/webhook',
      body: '{"message": "test"}',
    }

    expect(() => validateAllInputs(inputs)).not.toThrow()
  })

  it('should pass for valid inputs with convenience params', () => {
    const inputs = {
      client_id: 'test-client-id',
      client_secret: 'test-secret',
      tenant_id: 'test-tenant',
      webhook_url: 'https://example.com/webhook',
      status: 'success' as const,
      title: 'Build Complete',
    }

    expect(() => validateAllInputs(inputs)).not.toThrow()
  })

  it('should throw for missing required inputs', () => {
    const inputs = {
      webhook_url: 'https://example.com/webhook',
      body: '{"message": "test"}',
    }

    expect(() => validateAllInputs(inputs)).toThrow(ValidationError)
  })

  it('should throw for HTTP URL', () => {
    const inputs = {
      client_id: 'test-client-id',
      client_secret: 'test-secret',
      tenant_id: 'test-tenant',
      webhook_url: 'http://example.com/webhook',
      body: '{"message": "test"}',
    }

    expect(() => validateAllInputs(inputs)).toThrow(ValidationError)
    expect(() => validateAllInputs(inputs)).toThrow(
      'Webhook URL must use HTTPS'
    )
  })
})
