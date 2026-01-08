/**
 * MS Teams Webhook Notification Action - Main entry point
 * Orchestrates authentication, validation, and notification delivery.
 */

import * as core from '@actions/core'
import type { ActionInputs, ActionOutputs } from './types.js'
import { validateAllInputs } from './validate.js'
import { getAccessToken } from './auth.js'
import { sendNotificationWithRetry } from './notify.js'
import { buildPayload } from './payload.js'

/**
 * Reads and parses all action inputs from the workflow.
 */
function getInputs(): ActionInputs {
  return {
    // Required authentication inputs
    client_id: core.getInput('client_id', { required: true }),
    client_secret: core.getInput('client_secret', { required: true }),
    tenant_id: core.getInput('tenant_id', { required: true }),
    webhook_url: core.getInput('webhook_url', { required: true }),

    // Optional message inputs
    body: core.getInput('body') || undefined,
    status: (core.getInput('status') || undefined) as
      | 'success'
      | 'failure'
      | 'cancelled'
      | undefined,
    title: core.getInput('title') || undefined,
    summary: core.getInput('summary') || undefined,
    repository: core.getInput('repository') || undefined,
    run_url: core.getInput('run_url') || undefined,

    // Optional configuration inputs
    dry_run: core.getInput('dry_run') === 'true',
    fail_on_error: core.getInput('fail_on_error') === 'true',
    timeout: parseInt(core.getInput('timeout') || '10000', 10),
  }
}

/**
 * Sets all action outputs.
 */
function setOutputs(outputs: Partial<ActionOutputs>): void {
  if (outputs.notification_sent !== undefined) {
    core.setOutput('notification_sent', outputs.notification_sent)
  }
  if (outputs.response_code !== undefined) {
    core.setOutput('response_code', outputs.response_code)
  }
  if (outputs.retry_count !== undefined) {
    core.setOutput('retry_count', outputs.retry_count)
  }
  if (outputs.duration_ms !== undefined) {
    core.setOutput('duration_ms', outputs.duration_ms)
  }
  if (outputs.error_message !== undefined) {
    core.setOutput('error_message', outputs.error_message)
  }
  if (outputs.skip_reason !== undefined) {
    core.setOutput('skip_reason', outputs.skip_reason)
  }
}

/**
 * Main action execution function.
 * Handles the complete workflow: validate -> authenticate -> notify -> output.
 */
export async function run(): Promise<void> {
  const startTime = Date.now()

  try {
    // Get and mask secrets
    const inputs = getInputs()
    core.setSecret(inputs.client_secret)

    // Validate all inputs before any network activity
    core.info('Validating inputs...')
    validateAllInputs(inputs)

    // Handle dry-run mode
    if (inputs.dry_run) {
      core.info('Dry-run mode enabled - skipping HTTP transmission')
      
      // Build and log payload with secrets redacted (FR-022)
      const payloadResult = buildPayload(inputs)
      if (payloadResult.warning) {
        core.warning(payloadResult.warning)
      }
      core.info(`Payload (dry-run): ${JSON.stringify(payloadResult.payload, null, 2)}`)
      
      const durationMs = Date.now() - startTime
      setOutputs({
        notification_sent: 'false',
        response_code: '',
        retry_count: '0',
        duration_ms: durationMs.toString(),
        error_message: '',
        skip_reason: 'dry_run',
      })
      return
    }

    // Authenticate with Microsoft Identity Platform (US1 - T019-T020)
    core.info('Authenticating with Microsoft Identity Platform...')
    const authResult = await getAccessToken({
      clientId: inputs.client_id,
      clientSecret: inputs.client_secret,
      tenantId: inputs.tenant_id,
    })
    
    // Mask the access token (FR-014)
    core.setSecret(authResult.accessToken)

    // Build the payload from body or convenience parameters (US3 - T036-T041)
    const payloadResult = buildPayload(inputs)
    if (payloadResult.warning) {
      core.warning(payloadResult.warning)
    }
    const payload = payloadResult.payload

    // Send notification with retry on transient failures (US4 - T046-T051)
    core.info('Sending notification to Teams webhook...')
    const notifyResult = await sendNotificationWithRetry({
      webhookUrl: inputs.webhook_url,
      accessToken: authResult.accessToken,
      payload,
      timeout: inputs.timeout ?? 10000,
    })

    const durationMs = Date.now() - startTime

    if (notifyResult.success) {
      setOutputs({
        notification_sent: 'true',
        response_code: notifyResult.statusCode.toString(),
        retry_count: notifyResult.retryCount.toString(),
        duration_ms: durationMs.toString(),
        error_message: '',
        skip_reason: '',
      })
      core.info(`Notification sent successfully (HTTP ${notifyResult.statusCode})`)
    } else {
      const errorMessage = notifyResult.error?.message ?? 'Unknown error'
      setOutputs({
        notification_sent: 'false',
        response_code: notifyResult.statusCode.toString(),
        retry_count: notifyResult.retryCount.toString(),
        duration_ms: durationMs.toString(),
        error_message: errorMessage,
        skip_reason: '',
      })

      if (inputs.fail_on_error) {
        core.setFailed(errorMessage)
      } else {
        core.warning(`Notification failed: ${errorMessage}`)
      }
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : String(error)

    setOutputs({
      notification_sent: 'false',
      response_code: '',
      retry_count: '0',
      duration_ms: durationMs.toString(),
      error_message: errorMessage,
      skip_reason: '',
    })

    // Check fail_on_error setting
    const failOnError = core.getInput('fail_on_error') === 'true'
    if (failOnError) {
      core.setFailed(errorMessage)
    } else {
      core.warning(`Notification failed: ${errorMessage}`)
    }
  }
}
