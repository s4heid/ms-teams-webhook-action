/**
 * Type definitions for MS Teams Webhook Notification Action
 * Generated from data-model.md
 */

// =============================================================================
// Action Inputs
// =============================================================================

/**
 * Required inputs for the action.
 * All secrets should be passed via ${{ secrets.* }} references.
 */
export interface RequiredInputs {
  /** Azure AD application client ID */
  client_id: string

  /** Azure AD application client secret (sensitive) */
  client_secret: string

  /** Azure AD tenant ID */
  tenant_id: string

  /** Power Automate webhook URL (sensitive - contains signature) */
  webhook_url: string
}

/**
 * Message body - either explicit JSON or convenience parameters.
 * If body is provided, convenience parameters are ignored.
 */
export interface MessageInputs {
  /** Explicit JSON body (simple message or Adaptive Card) */
  body?: string

  /** Convenience: Build status (success | failure | cancelled) */
  status?: 'success' | 'failure' | 'cancelled'

  /** Convenience: Notification title */
  title?: string

  /** Convenience: Summary text or error description */
  summary?: string

  /** Convenience: Repository name (owner/repo format) */
  repository?: string

  /** Convenience: URL to workflow run */
  run_url?: string
}

/**
 * Optional configuration inputs.
 */
export interface ConfigInputs {
  /** Skip HTTP transmission, validate and log payload only */
  dry_run?: boolean

  /** Fail the workflow step if notification fails */
  fail_on_error?: boolean

  /** Request timeout in milliseconds */
  timeout?: number
}

/**
 * Complete action inputs combining all input groups.
 */
export type ActionInputs = RequiredInputs & MessageInputs & ConfigInputs

// =============================================================================
// Action Outputs
// =============================================================================

/**
 * Structured outputs emitted by the action.
 * All values are strings as required by GitHub Actions.
 */
export interface ActionOutputs {
  /** Whether notification was successfully sent */
  notification_sent: 'true' | 'false'

  /** HTTP status code from webhook response (empty if not sent) */
  response_code: string

  /** Number of retry attempts made (0-3) */
  retry_count: string

  /** Total execution time in milliseconds */
  duration_ms: string

  /** Error message if notification failed (empty on success) */
  error_message: string

  /** Reason for skipping if not sent (duplicate | dry_run | empty on send) */
  skip_reason: string
}

// =============================================================================
// OAuth Token Response
// =============================================================================

/**
 * Response from Microsoft Identity Platform token endpoint.
 * https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
 */
export interface TokenResponse {
  /** Always "Bearer" for OAuth2 */
  token_type: 'Bearer'

  /** Token validity in seconds (typically 3599 = ~1 hour) */
  expires_in: number

  /** JWT access token to use in Authorization header */
  access_token: string
}

/**
 * Error response from token endpoint.
 */
export interface TokenErrorResponse {
  /** Error code (e.g., "invalid_client", "invalid_grant") */
  error: string

  /** Human-readable error description */
  error_description: string

  /** Correlation ID for Microsoft support */
  correlation_id?: string

  /** Trace ID for Microsoft support */
  trace_id?: string
}

// =============================================================================
// Notification Payloads
// =============================================================================

/**
 * Simple message format for basic notifications.
 */
export interface SimpleMessage {
  message: string
}

/**
 * Adaptive Card format for rich notifications.
 * See: https://adaptivecards.io/schemas/adaptive-card.json
 */
export interface AdaptiveCard {
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json'
  type: 'AdaptiveCard'
  version: '1.5'
  body: AdaptiveCardElement[]
  actions?: AdaptiveCardAction[]
}

/**
 * Subset of Adaptive Card elements we generate.
 */
export type AdaptiveCardElement = TextBlock | FactSet | ColumnSet | Image

export interface TextBlock {
  type: 'TextBlock'
  text: string
  weight?: 'Default' | 'Bolder' | 'Lighter'
  size?: 'Default' | 'Small' | 'Medium' | 'Large' | 'ExtraLarge'
  wrap?: boolean
  style?: 'default' | 'heading'
  color?: 'Default' | 'Accent' | 'Good' | 'Warning' | 'Attention'
}

export interface FactSet {
  type: 'FactSet'
  facts: Array<{ title: string; value: string }>
}

export interface ColumnSet {
  type: 'ColumnSet'
  columns: Column[]
}

export interface Column {
  type: 'Column'
  width: number | 'auto' | 'stretch'
  items: AdaptiveCardElement[]
}

export interface Image {
  type: 'Image'
  url: string
  altText?: string
}

export type AdaptiveCardAction = ActionOpenUrl | ActionSubmit

export interface ActionOpenUrl {
  type: 'Action.OpenUrl'
  title: string
  url: string
}

export interface ActionSubmit {
  type: 'Action.Submit'
  title: string
  tooltip?: string
}

/**
 * Union of all valid notification payload types.
 */
export type NotificationPayload =
  SimpleMessage | AdaptiveCard | Record<string, unknown>

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Authentication result from OAuth flow.
 */
export interface AuthResult {
  /** Bearer token for Authorization header */
  accessToken: string

  /** When token expires (for potential caching) */
  expiresAt: Date
}

/**
 * Result from notification attempt.
 */
export interface NotifyResult {
  /** Whether notification was accepted (HTTP 202) */
  success: boolean

  /** HTTP status code */
  statusCode: number

  /** Number of retries performed */
  retryCount: number

  /** Total time spent including retries */
  durationMs: number

  /** Error if failed */
  error?: Error
}

/**
 * Validated and parsed action configuration.
 */
export interface ActionConfig {
  /** OAuth credentials */
  auth: {
    clientId: string
    clientSecret: string
    tenantId: string
  }

  /** Webhook destination */
  webhookUrl: string

  /** Notification content */
  payload: NotificationPayload

  /** Behavioral options */
  options: {
    dryRun: boolean
    failOnError: boolean
    timeout: number
  }
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Custom error for authentication failures.
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly correlationId?: string
  ) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Custom error for notification delivery failures.
 */
export class NotificationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryCount: number
  ) {
    super(message)
    this.name = 'NotificationError'
  }
}

/**
 * Custom error for input validation failures.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
