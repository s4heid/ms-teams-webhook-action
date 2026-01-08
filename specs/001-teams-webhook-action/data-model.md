# Data Model: MS Teams Webhook Notification Action

**Phase**: 1 - Design & Contracts  
**Date**: 2026-01-08  
**Plan**: [plan.md](./plan.md)

## Type Definitions

### Action Inputs

```typescript
/**
 * Required inputs for the action.
 * All secrets should be passed via ${{ secrets.* }} references.
 */
interface RequiredInputs {
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
interface MessageInputs {
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
interface ConfigInputs {
  /** Skip HTTP transmission, validate and log payload only */
  dry_run?: boolean // default: false

  /** Fail the workflow step if notification fails */
  fail_on_error?: boolean // default: false

  /** Request timeout in milliseconds */
  timeout?: number // default: 10000 (10 seconds)
}

/**
 * Complete action inputs combining all input groups.
 */
type ActionInputs = RequiredInputs & MessageInputs & ConfigInputs
```

### Action Outputs

```typescript
/**
 * Structured outputs emitted by the action.
 * All values are strings as required by GitHub Actions.
 */
interface ActionOutputs {
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
```

### OAuth Token Response

```typescript
/**
 * Response from Microsoft Identity Platform token endpoint.
 * https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
 */
interface TokenResponse {
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
interface TokenErrorResponse {
  /** Error code (e.g., "invalid_client", "invalid_grant") */
  error: string

  /** Human-readable error description */
  error_description: string

  /** Correlation ID for Microsoft support */
  correlation_id?: string

  /** Trace ID for Microsoft support */
  trace_id?: string
}
```

### Notification Payloads

```typescript
/**
 * Simple message format for basic notifications.
 */
interface SimpleMessage {
  message: string
}

/**
 * Adaptive Card format for rich notifications.
 * See: https://adaptivecards.io/schemas/adaptive-card.json
 */
interface AdaptiveCard {
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json'
  type: 'AdaptiveCard'
  version: '1.5'
  body: AdaptiveCardElement[]
  actions?: AdaptiveCardAction[]
}

/**
 * Subset of Adaptive Card elements we generate.
 */
type AdaptiveCardElement =
  | TextBlock
  | FactSet
  | ColumnSet
  | Image

interface TextBlock {
  type: 'TextBlock'
  text: string
  weight?: 'Default' | 'Bolder' | 'Lighter'
  size?: 'Default' | 'Small' | 'Medium' | 'Large' | 'ExtraLarge'
  wrap?: boolean
  style?: 'default' | 'heading'
}

interface FactSet {
  type: 'FactSet'
  facts: Array<{ title: string; value: string }>
}

interface ColumnSet {
  type: 'ColumnSet'
  columns: Column[]
}

interface Column {
  type: 'Column'
  width: number | 'auto' | 'stretch'
  items: AdaptiveCardElement[]
}

interface Image {
  type: 'Image'
  url: string
  altText?: string
}

type AdaptiveCardAction =
  | ActionOpenUrl
  | ActionSubmit

interface ActionOpenUrl {
  type: 'Action.OpenUrl'
  title: string
  url: string
}

interface ActionSubmit {
  type: 'Action.Submit'
  title: string
  tooltip?: string
}

/**
 * Union of all valid notification payload types.
 */
type NotificationPayload = SimpleMessage | AdaptiveCard | Record<string, unknown>
```

### Internal Types

```typescript
/**
 * Authentication result from OAuth flow.
 */
interface AuthResult {
  /** Bearer token for Authorization header */
  accessToken: string

  /** When token expires (for potential caching) */
  expiresAt: Date
}

/**
 * Result from notification attempt.
 */
interface NotifyResult {
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
interface ActionConfig {
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
```

## Entity Relationships

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  ActionInputs   │────▶│   ActionConfig   │────▶│   AuthResult    │
│  (raw strings)  │     │  (validated)     │     │  (accessToken)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                        │
                               │                        ▼
                               │                 ┌─────────────────┐
                               │                 │  NotifyResult   │
                               │                 │  (success/fail) │
                               │                 └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │NotificationPayload│    │  ActionOutputs  │
                        │ (JSON body)       │    │  (strings)      │
                        └──────────────────┘     └─────────────────┘
```

## Validation Rules

| Field | Validation | Error Message |
|-------|------------|---------------|
| `client_id` | Non-empty UUID format | "client_id is required and must be a valid UUID" |
| `client_secret` | Non-empty string | "client_secret is required" |
| `tenant_id` | Non-empty UUID or domain | "tenant_id is required" |
| `webhook_url` | Valid HTTPS URL | "webhook_url must be a valid HTTPS URL" |
| `body` | Valid JSON if provided | "body must be valid JSON" |
| `status` | One of: success, failure, cancelled | "status must be one of: success, failure, cancelled" |
| `body` OR `status`/`title` | At least one message source | "Either body or convenience parameters (status, title) must be provided" |
| `timeout` | Positive integer ≤ 30000 | "timeout must be between 1 and 30000 milliseconds" |

## State Transitions

```text
                    ┌──────────────┐
                    │    START     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   VALIDATE   │──────▶ [Invalid] ──▶ FAILED
                    └──────┬───────┘
                           │ [Valid]
                           ▼
                    ┌──────────────┐
             ┌──────│   DRY_RUN?   │
             │      └──────┬───────┘
             │ [Yes]       │ [No]
             ▼             ▼
      ┌──────────┐  ┌──────────────┐
      │ LOG_ONLY │  │ AUTHENTICATE │──────▶ [AuthError] ──▶ FAILED
      └────┬─────┘  └──────┬───────┘
           │               │ [Token]
           │               ▼
           │        ┌──────────────┐
           │        │    NOTIFY    │──────▶ [NetworkError + Retries]
           │        └──────┬───────┘                │
           │               │ [202]                  │ [ExhaustedRetries]
           │               ▼                        ▼
           │        ┌──────────────┐         ┌──────────────┐
           └───────▶│   SUCCESS    │         │    FAILED    │
                    └──────────────┘         └──────────────┘
                           │                        │
                           ▼                        ▼
                    ┌────────────────────────────────────────┐
                    │              SET OUTPUTS               │
                    │  notification_sent, response_code, etc │
                    └────────────────────────────────────────┘
```
