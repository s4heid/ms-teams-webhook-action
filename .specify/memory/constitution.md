<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version Change: N/A → 1.0.0 (Initial ratification)
  
  Modified Principles: None (initial creation)
  
  Added Sections:
    - Core Principles (I-VI: Secrets, SHA Pinning, Workflow Security, Token
      Permissions, Secret Scanning, Message Content)
    - Operational Rules (triggers, retries, idempotency, observability,
      graceful degradation)
    - Testing Standards (dry-run, negative/security tests, performance SLAs)
    - Governance (review process, versioning, audit/retention)
  
  Removed Sections: None (initial creation)
  
  Templates Requiring Updates:
    ✅ plan-template.md - Constitution Check section compatible
    ✅ spec-template.md - Requirements section compatible
    ✅ tasks-template.md - Phase structure compatible
  
  Follow-up TODOs: None
  ============================================================================
-->

# Slack CI/CD Notification Action Constitution

This constitution establishes the non-negotiable principles, operational rules, testing standards,
and governance policies for the GitHub Action that sends CI/CD notifications to a Slack Incoming
Webhook. Security-first governance is the foundational requirement.

## Core Principles

### I. Secrets Management (NON-NEGOTIABLE)

All sensitive credentials MUST be stored in GitHub repository secrets or environment secrets.
Hard-coding secrets in workflow files, action code, or configuration is strictly prohibited.

- Webhook URLs MUST be referenced via `${{ secrets.SLACK_WEBHOOK_URL }}` or equivalent
- OIDC-based retrieval from external secret stores (AWS Secrets Manager, Azure Key Vault,
  HashiCorp Vault) SHOULD be preferred when the runtime environment supports it
- Secrets MUST NOT appear in logs, error messages, or step outputs
- All secret access patterns MUST be auditable via workflow run logs

**Rationale**: Hard-coded secrets are the primary vector for credential exposure in public
repositories. Environment/repository secrets leverage GitHub's encrypted storage and access
controls.

### II. Third-Party Action Pinning (NON-NEGOTIABLE)

All third-party GitHub Actions MUST be pinned to full-length commit SHAs (40 characters).
Version tags (e.g., `v1`, `v1.2.3`) are mutable and MUST NOT be used.

- Format: `uses: owner/action@<full-sha>` (e.g., `actions/checkout@a5ac7e...`)
- SHA pins MUST be accompanied by a comment indicating the semantic version for readability
- Dependabot or Renovate SHOULD be configured to propose SHA updates with changelog review
- First-party `actions/*` MAY use version tags only if organizational policy explicitly permits

**Rationale**: Mutable tags can be force-pushed, enabling supply-chain attacks. SHA pinning
guarantees reproducible builds and auditability.

### III. Workflow Security (NON-NEGOTIABLE)

The `pull_request_target` trigger MUST be avoided unless explicit mitigations are documented
and approved. When `pull_request_target` is required, the following mitigations are mandatory:

- NEVER checkout untrusted PR code in the same job that has access to secrets
- Use a two-job pattern: Job 1 (no secrets) validates; Job 2 (secrets) executes if validated
- Require explicit maintainer approval label before execution
- Log and audit all `pull_request_target` executions

Prefer `pull_request` or `workflow_run` triggers for fork-safe processing.

**Rationale**: `pull_request_target` runs with write permissions and secret access against
untrusted code, creating a privilege escalation vector.

### IV. GITHUB_TOKEN Permissions (NON-NEGOTIABLE)

Workflow files MUST declare `permissions` at the workflow or job level. The default MUST be
restrictive (`contents: read` or narrower).

```yaml
permissions:
  contents: read
```

Elevated permissions MUST be scoped to specific jobs with documented justification:

```yaml
jobs:
  notify:
    permissions:
      contents: read    # Required for checkout
      # No additional permissions needed for Slack webhook POST
```

**Rationale**: Principle of least privilege limits blast radius if the workflow is compromised.

### V. Secret Scanning & Rotation (NON-NEGOTIABLE)

GitHub Secret Scanning MUST be enabled on the repository. Push protection SHOULD be enabled
to block commits containing detected secrets.

Upon exposure detection:

1. Rotate the compromised secret immediately (within 1 hour maximum)
2. Invalidate the old secret at the source (Slack Incoming Webhook regeneration)
3. Update the GitHub secret with the new value
4. Audit workflow runs during the exposure window
5. Document the incident in the repository's security log

**Rationale**: Proactive scanning and rapid rotation limit the exposure window for leaked
credentials.

### VI. Message Content Safety (NON-NEGOTIABLE)

Slack notification payloads MUST NOT contain sensitive information:

- No secrets, tokens, API keys, or credentials
- No personally identifiable information (PII)
- No internal IP addresses, hostnames, or infrastructure details beyond public URLs
- No full stack traces (summarize or link to private logs)

Allowed content:

- Build status (success/failure/cancelled)
- Repository name, branch, commit SHA, PR number
- Actor (GitHub username triggering the workflow)
- Links to public workflow run URLs
- Duration and timing information
- Non-sensitive custom messages defined by workflow authors

**Rationale**: Slack workspaces may have broad membership. Notification content should be
safe for incidental exposure.

## Operational Rules

### Trigger Configuration

The action MUST support the following workflow triggers at minimum:

| Trigger            | Use Case                              | Notes                        |
|--------------------|---------------------------------------|------------------------------|
| `push`             | Branch push notifications             | Configurable branch filter   |
| `pull_request`     | PR opened/synchronized/closed         | Fork-safe, no secrets by default |
| `workflow_run`     | Completion of other workflows         | For cross-workflow notifications |
| `release`          | Release published                     | Production deployment alerts |
| `schedule`         | Scheduled health checks               | Heartbeat notifications      |
| `workflow_dispatch`| Manual trigger for testing            | Requires input validation    |

### Retries & Backoff

Network failures to the Slack API MUST be handled with exponential backoff:

- Maximum retries: 3
- Initial delay: 1 second
- Backoff multiplier: 2x (1s → 2s → 4s)
- Maximum delay: 10 seconds
- Jitter: ±20% to avoid thundering herd

After exhausting retries, the step MUST fail with a clear error message but SHOULD NOT fail
the entire workflow (see Graceful Degradation).

### Idempotency & Deduplication

Notifications SHOULD be idempotent based on a composite key:

- `{repository, run_id, job_name, attempt_number}`

Duplicate suppression:

- If the same notification was sent within the last 60 seconds (same key), skip sending
- Deduplication state MAY be stored in workflow artifacts or action outputs
- Manual retries (`workflow_dispatch` with same run context) SHOULD send regardless

### Observability

All notification operations MUST emit structured output:

```yaml
outputs:
  notification_sent: 'true' | 'false'
  message_id: '<slack_ts_or_request_id>'
  response_code: '<http_status>'
  retry_count: '<0-3>'
  duration_ms: '<elapsed_time>'
```

Workflow logs MUST include:

- Notification payload (with secrets redacted)
- HTTP response status and headers (non-sensitive)
- Retry attempts with timestamps
- Final disposition (sent/failed/skipped)

### Graceful Degradation

Slack notification failure MUST NOT fail the CI/CD pipeline unless explicitly configured:

```yaml
- uses: ./
  with:
    fail_on_error: false  # Default: false
```

Degradation behavior:

- Log the failure with full context
- Set `notification_sent` output to `false`
- Continue workflow execution
- Optionally emit a warning annotation

When `fail_on_error: true`:

- Notification failure fails the step
- Useful for critical alerting workflows where notification is the primary purpose

## Testing Standards

### Dry-Run Mode (PR Validation)

All pull requests MUST execute the action in dry-run mode:

- Dry-run validates payload construction without HTTP transmission
- Dry-run outputs the constructed payload to logs (secrets redacted)
- Dry-run verifies input validation and error handling paths

```yaml
- uses: ./
  with:
    dry_run: true
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Negative & Security Tests

The test suite MUST include:

| Test Category       | Coverage Requirements                                 |
|---------------------|-------------------------------------------------------|
| Invalid webhook URL | Reject malformed URLs, non-HTTPS schemes              |
| Missing secrets     | Fail fast with actionable error message               |
| Payload injection   | Sanitize user-controlled inputs (commit messages, etc.)|
| Oversized payload   | Enforce Slack's 40KB message limit                    |
| Timeout handling    | Verify behavior under network latency (simulated)     |
| Rate limiting       | Handle Slack 429 responses correctly                  |
| Secret masking      | Confirm secrets never appear in logs/outputs          |

### Performance SLAs

| Metric                     | Target          | Measurement Method              |
|----------------------------|-----------------|----------------------------------|
| Cold start execution       | < 5 seconds     | Time from step start to output   |
| Payload construction       | < 100ms         | Internal timing                  |
| HTTP request (p95)         | < 2 seconds     | Slack API response time          |
| Total step duration (p99)  | < 15 seconds    | Including retries                |

Performance tests SHOULD run on `ubuntu-latest` runner baseline.

## Governance

### Review Process

All changes to the action MUST undergo code review with the following gates:

1. **Security Review**: Changes to secrets handling, permissions, or external integrations
   require explicit security sign-off
2. **Constitution Compliance**: Reviewer MUST verify adherence to all NON-NEGOTIABLE principles
3. **Test Coverage**: New functionality requires corresponding test additions
4. **Documentation**: User-facing changes require README and example updates

### Versioning Policy

The action follows Semantic Versioning (MAJOR.MINOR.PATCH):

| Change Type                                    | Version Bump |
|------------------------------------------------|--------------|
| Breaking input/output changes                  | MAJOR        |
| Removal of supported triggers or features      | MAJOR        |
| Security policy changes reducing compatibility | MAJOR        |
| New optional inputs or outputs                 | MINOR        |
| New trigger support                            | MINOR        |
| Performance improvements                       | MINOR        |
| Bug fixes                                      | PATCH        |
| Documentation updates                          | PATCH        |
| Dependency updates (non-breaking)              | PATCH        |

Release tags MUST be immutable. Once `v1.2.3` is released, it MUST NOT be modified.
Major version tags (e.g., `v1`) MAY be updated to point to the latest minor/patch.

### Audit & Retention

- **Workflow run logs**: Retain for minimum 90 days (GitHub default)
- **Security incidents**: Document in `.github/SECURITY_LOG.md` with timestamps
- **Constitution amendments**: Record in this file's version history with rationale
- **Dependency updates**: Track via Dependabot/Renovate PR history

Annual review:

- Audit all NON-NEGOTIABLE principle compliance
- Review and update operational thresholds (retries, timeouts, SLAs)
- Verify secret rotation has occurred at least once in the past year
- Update SHA pins to latest stable versions

### Amendment Procedure

1. Propose amendment via pull request modifying this constitution
2. Require approval from at least 2 maintainers
3. MAJOR principle changes require 7-day comment period
4. Document migration plan for breaking changes
5. Update version, ratification date, and sync impact report

This constitution supersedes all other development practices for this repository.
Deviations require explicit documented exceptions approved by maintainers.

**Version**: 1.0.0 | **Ratified**: 2026-01-08 | **Last Amended**: 2026-01-08
