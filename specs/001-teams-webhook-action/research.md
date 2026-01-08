# Research: MS Teams Webhook Notification Action

**Phase**: 0 - Outline & Research  
**Date**: 2026-01-08  
**Plan**: [plan.md](./plan.md)

## Research Tasks Completed

### 1. GitHub Action TypeScript Template Structure

**Decision**: Use `actions/typescript-action` as the project foundation

**Rationale**:

- Official GitHub template with best practices baked in
- Includes Jest testing setup with ESM support
- Rollup bundler configuration for single-file dist output
- Node.js 20+ runtime support
- TypeScript 5.x with strict mode
- Linting (ESLint), formatting (Prettier), and type-checking pre-configured

**Alternatives Considered**:

- Custom setup from scratch: Rejected - unnecessary effort, template is well-maintained
- `actions/javascript-action`: Rejected - TypeScript provides better type safety for complex OAuth flows

### 2. GitHub Actions Toolkit Packages

**Decision**: Use `@actions/core` and `@actions/http-client`

**Rationale**:

- `@actions/core`: Official package for input/output, logging, secret masking, failure handling
- `@actions/http-client`: Official HTTP client with built-in support for retries and proxies
- `@actions/github`: NOT needed - we don't interact with GitHub API, only MS Teams

**Alternatives Considered**:

- `node-fetch` or `axios`: Rejected - @actions/http-client is the official choice with proxy support
- `undici`: Rejected - extra dependency when http-client suffices

### 3. Microsoft OAuth2 Token Endpoint

**Decision**: Use client credentials flow with `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`

**Rationale**:

- Standard OAuth2 client credentials grant
- No user interaction required (service-to-service)
- Scope `https://service.flow.microsoft.com//.default` grants Power Automate access
- Token response is standard JSON with `access_token`, `token_type`, `expires_in`

**Implementation Notes**:

- POST with `application/x-www-form-urlencoded` body
- Parameters: `client_id`, `client_secret`, `grant_type=client_credentials`, `scope`
- Error responses include `error` and `error_description` for actionable messages

### 4. Power Automate Webhook Format

**Decision**: POST to webhook URL with Bearer token authorization

**Rationale**:

- Modern Power Automate HTTP triggers require Azure AD authentication
- Request format: `Authorization: Bearer {access_token}` header
- Body is arbitrary JSON - simple message or Adaptive Card
- Response is HTTP 202 Accepted on success

**Implementation Notes**:

- Content-Type: `application/json`
- Body can be `{"message": "text"}` for simple notifications
- Adaptive Cards follow the [Adaptive Cards schema](https://adaptivecards.io/schemas/adaptive-card.json)
- Maximum payload size: ~28KB for Adaptive Cards

### 5. Testing Strategy

**Decision**: Jest with ts-jest in ESM mode, mocking `@actions/core` and HTTP client

**Rationale**:

- Jest is the template's default and widely understood
- ESM mode aligns with modern TypeScript practices
- Fixture-based mocking pattern from template isolates tests from actual APIs
- No integration tests with real MS endpoints - use dry-run for E2E validation

**Test Categories**:

| Category | Implementation |
|----------|----------------|
| Unit tests | Mock HTTP client, test each module in isolation |
| Contract tests | Validate input parsing against action.yml schema |
| Security tests | Verify secrets never logged, HTTPS validation works |
| Error handling | Simulate various failure modes (auth errors, network timeouts) |

### 6. Retry Implementation

**Decision**: Custom exponential backoff with jitter in `retry.ts`

**Rationale**:

- Constitution requires: 3 retries, 1s→2s→4s delays, ±20% jitter
- `@actions/http-client` has basic retry but doesn't meet jitter requirement
- Simple implementation (~50 LOC) avoids external dependencies

**Implementation Notes**:

```typescript
// Pseudocode
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 1000 // 1 second
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error
      const jitter = delay * 0.2 * (Math.random() * 2 - 1) // ±20%
      await sleep(delay + jitter)
      delay *= 2
    }
  }
}
```

### 7. Convenience Parameters to Adaptive Card

**Decision**: Build Adaptive Card from convenience inputs using template literals

**Rationale**:

- Convenience inputs: `status`, `title`, `summary`, `repository`, `run_url`
- Map `status` to color/icon: success=green, failure=red, cancelled=grey
- Generate minimal Adaptive Card v1.5 structure
- User can always override with explicit `body` parameter

**Template Structure**:

```json
{
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    { "type": "TextBlock", "text": "{title}", "weight": "Bolder", "size": "Large" },
    { "type": "TextBlock", "text": "{summary}" },
    { "type": "FactSet", "facts": [
      { "title": "Repository", "value": "{repository}" },
      { "title": "Status", "value": "{status}" }
    ]}
  ],
  "actions": [
    { "type": "Action.OpenUrl", "title": "View Run", "url": "{run_url}" }
  ]
}
```

### 8. Secret Masking Strategy

**Decision**: Use `core.setSecret()` for all sensitive values immediately upon receipt

**Rationale**:

- `core.setSecret()` registers values with the runner's log masker
- Must be called before any logging that might contain the value
- Apply to: `client_secret`, `access_token`, `webhook_url` (contains signature)

**Implementation Notes**:

- Call `core.setSecret(value)` immediately in `main.ts` before any processing
- Validate masking in tests by checking logs don't contain test secret values

## All NEEDS CLARIFICATION Resolved

No unresolved clarifications - all technical decisions documented above.
