# Implementation Plan: MS Teams Webhook Notification Action

**Branch**: `001-teams-webhook-action` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-teams-webhook-action/spec.md`

## Summary

Create a GitHub Action that sends customizable CI/CD notifications to a secure MS Teams Webhook
using OAuth2 client credentials authentication. The action authenticates via Microsoft Identity
Platform, then sends notification payloads (simple messages or Adaptive Cards) to a Power Automate
webhook URL. Built with TypeScript following the `actions/typescript-action` template, using Jest
for testing.

## Technical Context

**Language/Version**: TypeScript 5.x (targeting Node.js 20.x runtime)  
**Primary Dependencies**: @actions/core, @actions/github, @actions/http-client  
**Storage**: N/A (stateless action)  
**Testing**: Jest with ts-jest (ESM mode)  
**Target Platform**: GitHub Actions runners (ubuntu-latest, windows-latest, macos-latest)
**Project Type**: Single project (GitHub Action)  
**Performance Goals**: < 5 seconds total execution including authentication  
**Constraints**: < 15 seconds p99 with retries, 28KB message payload limit  
**Scale/Scope**: Single action, ~500-800 LOC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Implementation |
|-----------|--------|----------------|
| I. Secrets Management (NON-NEGOTIABLE) | ✅ PASS | client_id, client_secret, tenant_id, webhook_url passed via `${{ secrets.* }}`; never logged |
| II. Third-Party Action Pinning (NON-NEGOTIABLE) | ✅ PASS | CI workflows use SHA-pinned actions; action.yml documents requirement |
| III. Workflow Security (NON-NEGOTIABLE) | ✅ PASS | No `pull_request_target` usage; action works with `pull_request` trigger |
| IV. GITHUB_TOKEN Permissions (NON-NEGOTIABLE) | ✅ PASS | Action requires no GITHUB_TOKEN permissions; workflows declare `contents: read` |
| V. Secret Scanning & Rotation (NON-NEGOTIABLE) | ✅ PASS | README documents rotation procedure; no secrets in code |
| VI. Message Content Safety (NON-NEGOTIABLE) | ✅ PASS | Payload sanitization in convenience mode; user-provided bodies are user responsibility |
| Retries & Backoff | ✅ PASS | Exponential backoff: 3 retries, 1s→2s→4s with jitter |
| Observability | ✅ PASS | Structured outputs: notification_sent, response_code, retry_count, duration_ms |
| Graceful Degradation | ✅ PASS | fail_on_error defaults to false |
| Dry-Run Mode | ✅ PASS | dry_run input validates without HTTP transmission |

**Gate Result**: ✅ ALL PRINCIPLES SATISFIED - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/001-teams-webhook-action/
├── plan.md              # This file
├── research.md          # Phase 0 output - technology decisions
├── data-model.md        # Phase 1 output - type definitions
├── quickstart.md        # Phase 1 output - usage guide
├── contracts/           # Phase 1 output - API contracts
│   └── action-schema.yml
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.ts             # Action entrypoint
├── main.ts              # Main run() function
├── auth.ts              # OAuth2 authentication service
├── notify.ts            # Notification delivery service
├── payload.ts           # Payload construction (convenience → Adaptive Card)
├── retry.ts             # Retry with exponential backoff
├── validate.ts          # Input validation
└── types.ts             # TypeScript interfaces

__tests__/
├── main.test.ts         # Integration tests for run()
├── auth.test.ts         # Auth service unit tests
├── notify.test.ts       # Notification service unit tests
├── payload.test.ts      # Payload construction tests
├── retry.test.ts        # Retry logic tests
└── validate.test.ts     # Input validation tests

__fixtures__/
├── core.ts              # @actions/core mock
└── http-client.ts       # HTTP client mock

action.yml               # Action metadata
dist/                    # Bundled action (generated)
```

**Structure Decision**: Single project structure following `actions/typescript-action` template.
Source in `src/`, tests in `__tests__/`, mocks in `__fixtures__/`, bundled output in `dist/`.

## Complexity Tracking

> No violations requiring justification - all constitution principles satisfied.
