# Feature Specification: MS Teams Webhook Notification Action

**Feature Branch**: `001-teams-webhook-action`  
**Created**: 2026-01-08  
**Status**: Draft  
**Input**: User description: "Create a GitHub Action that sends customizable notifications to a secure MS Teams Webhook with OAuth2 authentication"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send Basic CI/CD Notification (Priority: P1)

A DevOps engineer wants to notify their team's MS Teams channel when a CI/CD pipeline completes,
so the team stays informed about build and deployment status without checking GitHub manually.

**Why this priority**: This is the core value proposition—sending notifications to Teams. Without
this working, the action has no purpose. All other features build on this foundation.

**Independent Test**: Can be fully tested by triggering the action with required credentials and
a simple message body, then verifying the message appears in the Teams channel.

**Acceptance Scenarios**:

1. **Given** valid OAuth2 credentials (clientId, clientSecret, tenantId) and a webhook URL,
   **When** the action executes with a simple message body `{"message": "Build successful"}`,
   **Then** the message appears in the configured Teams channel and the action outputs `notification_sent: true`.

2. **Given** valid credentials and webhook URL,
   **When** the action executes with a JSON body containing an Adaptive Card,
   **Then** the card renders correctly in Teams with all specified elements (text, images, actions).

3. **Given** valid credentials and webhook URL,
   **When** the Teams API returns HTTP 202 (Accepted),
   **Then** the action completes successfully and outputs the response code.

---

### User Story 2 - Handle Authentication Failures Gracefully (Priority: P1)

A DevOps engineer wants clear, actionable error messages when authentication fails, so they can
quickly diagnose and fix credential issues without debugging HTTP responses.

**Why this priority**: Authentication is a prerequisite for all notifications. Poor error handling
here blocks all functionality and creates frustrating debugging experiences.

**Independent Test**: Can be tested by providing invalid credentials and verifying the action
fails with a specific, actionable error message (not a generic HTTP error).

**Acceptance Scenarios**:

1. **Given** an invalid clientSecret,
   **When** the action attempts to authenticate,
   **Then** it fails with error message "Authentication failed: Invalid client credentials. Verify CLIENT_SECRET is correct."

2. **Given** an invalid tenantId,
   **When** the action attempts to authenticate,
   **Then** it fails with error message "Authentication failed: Tenant not found. Verify TENANT_ID is correct."

3. **Given** an expired or revoked clientId,
   **When** the action attempts to authenticate,
   **Then** it fails with error message "Authentication failed: Application not found or disabled. Verify CLIENT_ID and app registration status."

---

### User Story 3 - Use Convenience Parameters for Common Messages (Priority: P2)

A DevOps engineer wants to send common notification types (build status, deployment alerts)
without constructing JSON payloads manually, reducing boilerplate in workflow files.

**Why this priority**: Improves developer experience significantly but is not required for basic
functionality. Users can always fall back to providing a raw JSON body.

**Independent Test**: Can be tested by using convenience parameters like `status` and `title`
instead of a raw body, and verifying the generated message appears correctly in Teams.

**Acceptance Scenarios**:

1. **Given** convenience parameters `status: success`, `title: "Build Complete"`, `repository: myorg/myrepo`,
   **When** the action executes (without explicit `body` parameter),
   **Then** a formatted notification card appears in Teams showing the build status with appropriate styling.

2. **Given** convenience parameter `status: failure` with optional `summary: "3 tests failed"`,
   **When** the action executes,
   **Then** a failure-styled notification appears with the summary text visible.

3. **Given** both a `body` parameter and convenience parameters,
   **When** the action executes,
   **Then** the explicit `body` takes precedence and convenience parameters are ignored (with a warning log).

---

### User Story 4 - Retry on Transient Network Failures (Priority: P2)

A DevOps engineer wants the action to automatically retry when temporary network issues occur,
so notifications are delivered reliably without manual intervention.

**Why this priority**: Network reliability is important for production use but the core functionality
works without it. Retries improve reliability for edge cases.

**Independent Test**: Can be tested by simulating network failures (timeout, connection reset)
and verifying the action retries with backoff before ultimately succeeding or failing.

**Acceptance Scenarios**:

1. **Given** a temporary network timeout on first attempt,
   **When** the second attempt succeeds,
   **Then** the notification is delivered and `retry_count: 1` is output.

2. **Given** three consecutive network failures,
   **When** all retry attempts are exhausted,
   **Then** the action fails with error "Notification failed after 3 retries" and outputs `retry_count: 3`.

3. **Given** `fail_on_error: false` and network failures exhaust retries,
   **When** the action completes,
   **Then** `notification_sent: false` is output but the workflow step does not fail.

---

### User Story 5 - Validate and Dry-Run in Pull Requests (Priority: P2)

A DevOps engineer wants to validate their notification configuration in PRs without sending
actual messages, so they can catch errors before merging.

**Why this priority**: Essential for safe development workflow but not required for production use.
Aligns with constitution testing standards.

**Independent Test**: Can be tested by running the action with `dry_run: true` and verifying
no HTTP requests are made while payload validation still occurs.

**Acceptance Scenarios**:

1. **Given** `dry_run: true` and valid inputs,
   **When** the action executes,
   **Then** no HTTP requests are made, the constructed payload is logged (secrets redacted), and `notification_sent: false` is output.

2. **Given** `dry_run: true` and an invalid body (malformed JSON),
   **When** the action executes,
   **Then** validation fails with error "Invalid body: malformed JSON" before any network activity.

3. **Given** `dry_run: true` and missing required inputs,
   **When** the action executes,
   **Then** the action fails with specific missing input errors.

---

### User Story 6 - Prevent Duplicate Notifications (Priority: P3)

A DevOps engineer wants to avoid duplicate notifications when workflows are re-run or when
multiple jobs trigger the same notification, reducing channel noise.

**Why this priority**: Nice-to-have for reducing noise but not critical for core functionality.
Users can manage duplicates through workflow design if needed.

**Independent Test**: Can be tested by running the same action twice with identical context
and verifying the second invocation is skipped.

**Acceptance Scenarios**:

1. **Given** a notification was sent for `{repository, run_id, job_name, attempt_number}` within 60 seconds,
   **When** the same action executes again with identical context,
   **Then** the notification is skipped and `notification_sent: false` with `skip_reason: duplicate` is output.

2. **Given** a previous notification exists but `attempt_number` is different (workflow re-run),
   **When** the action executes,
   **Then** the notification is sent (not considered duplicate).

---

### Edge Cases

- What happens when the webhook URL is malformed or uses HTTP instead of HTTPS?
  - Action MUST reject non-HTTPS URLs with clear error: "Webhook URL must use HTTPS"
- What happens when the OAuth token response is malformed?
  - Action MUST fail with "Authentication failed: Invalid token response format"
- What happens when the body exceeds Teams' message size limit?
  - Action MUST fail with "Message body exceeds maximum size (28KB for Adaptive Cards)"
- What happens when the webhook endpoint returns 429 (rate limited)?
  - Action MUST respect Retry-After header and retry, or fail after max retries
- What happens when credentials are correct but app lacks permission for the webhook?
  - Action MUST fail with "Authorization failed: Insufficient permissions for webhook"

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication Flow

- **FR-001**: Action MUST obtain OAuth2 access token via POST to `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
- **FR-002**: Token request MUST include parameters: `client_id`, `client_secret`, `grant_type=client_credentials`, `scope=https://service.flow.microsoft.com//.default`
- **FR-003**: Action MUST parse `access_token` from successful JSON response
- **FR-004**: Action MUST handle token endpoint errors with specific, actionable messages

#### Notification Delivery

- **FR-005**: Action MUST send POST request to webhook URL with header `Authorization: Bearer {access_token}`
- **FR-006**: Action MUST accept arbitrary JSON body via `body` input parameter
- **FR-007**: Action MUST support simple message format: `{"message": "text"}`
- **FR-008**: Action MUST support Adaptive Card format per MS Teams schema
- **FR-009**: Action MUST treat HTTP 202 response as success

#### Input Parameters

- **FR-010**: Action MUST require inputs: `client_id`, `client_secret`, `tenant_id`, `webhook_url`
- **FR-011**: Action MUST require either `body` OR convenience parameters (`status`, `title`)
- **FR-012**: Action MUST support optional inputs: `dry_run`, `fail_on_error`, `timeout`
- **FR-013**: Action MUST support convenience inputs: `status` (success/failure/cancelled), `title`, `summary`, `repository`, `run_url`

#### Security (per Constitution)

- **FR-014**: Action MUST NOT log secrets (client_secret, access_token) under any circumstances
- **FR-015**: Action MUST validate webhook URL uses HTTPS scheme
- **FR-016**: Action MUST mask sensitive values in all output and error messages
- **FR-017**: Secrets MUST be passed via `${{ secrets.* }}` references only

#### Reliability (per Constitution)

- **FR-018**: Action MUST retry failed requests with exponential backoff (max 3 retries, 1s→2s→4s)
- **FR-019**: Action MUST support `fail_on_error` flag (default: false)
- **FR-020**: Action MUST emit structured outputs: `notification_sent`, `response_code`, `retry_count`, `duration_ms`

#### Testing Support

- **FR-021**: Action MUST support `dry_run` mode that validates without HTTP transmission
- **FR-022**: Dry-run MUST log constructed payload with secrets redacted

### Key Entities

- **OAuth Token Response**: Contains `token_type`, `expires_in`, `access_token` from Microsoft identity platform
- **Notification Payload**: User-provided JSON body, either simple message or Adaptive Card format
- **Action Inputs**: Configuration parameters passed from workflow file
- **Action Outputs**: Structured results including `notification_sent`, `response_code`, `retry_count`, `duration_ms`, `error_message`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can send a notification to Teams channel in under 5 seconds total (including auth)
- **SC-002**: Authentication errors provide specific remediation guidance in 100% of known failure modes
- **SC-003**: Transient network failures are recovered automatically in 95%+ of cases (with retry)
- **SC-004**: Dry-run mode catches 100% of input validation errors without network activity
- **SC-005**: Zero secrets appear in workflow logs or action outputs across all execution paths
- **SC-006**: Action completes within 15 seconds including maximum retry attempts (p99)
- **SC-007**: Users can send both simple messages and Adaptive Cards without modifying action configuration
- **SC-008**: Convenience parameters reduce workflow YAML by 50%+ compared to raw body for common cases

## Assumptions

The following assumptions are made based on the user description and common patterns:

1. **OAuth2 App Registration exists**: Users have already registered an Azure AD application with appropriate permissions for Power Automate/Flow webhooks
2. **Webhook URL format**: The webhook URL follows the Power Automate HTTP trigger format (not legacy Office 365 Connectors)
3. **Adaptive Card version**: Version 1.5 of Adaptive Cards is supported by the target Teams environment
4. **Network environment**: GitHub Actions runners have outbound HTTPS access to `login.microsoftonline.com` and the webhook host
5. **Message size limits**: Teams/Power Automate enforces approximately 28KB limit for Adaptive Cards
6. **Rate limits**: Power Automate webhook has reasonable rate limits that won't be exceeded by typical CI/CD usage
