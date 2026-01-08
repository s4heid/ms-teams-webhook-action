# Tasks: MS Teams Webhook Notification Action

**Input**: Design documents from `/specs/001-teams-webhook-action/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: ✅ Included - Jest tests per testing framework requirement from plan.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization using `actions/typescript-action` template

- [ ] T001 Create project structure based on actions/typescript-action template at repository root
- [ ] T002 Configure package.json with dependencies: @actions/core, @actions/github, @actions/http-client
- [ ] T003 [P] Configure tsconfig.json for ESM output targeting Node.js 20.x
- [ ] T004 [P] Configure Jest with ts-jest in ESM mode in jest.config.js
- [ ] T005 [P] Configure ESLint and Prettier per template defaults
- [ ] T006 [P] Create action.yml from contracts/action-schema.yml schema

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create TypeScript interfaces from data-model.md in src/types.ts
- [ ] T008 [P] Implement input validation logic for required fields in src/validate.ts
- [ ] T009 [P] Implement URL validation (HTTPS requirement) in src/validate.ts
- [ ] T010 [P] Implement JSON body validation in src/validate.ts
- [ ] T011 Create @actions/core mock for testing in **fixtures**/core.ts
- [ ] T012 [P] Create @actions/http-client mock for testing in **fixtures**/http-client.ts
- [ ] T013 [P] Create validation unit tests in **tests**/validate.test.ts
- [ ] T014 Create action entrypoint that wraps main in src/index.ts
- [ ] T015 Create main.ts shell with run() function signature in src/main.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Send Basic CI/CD Notification (Priority: P1) 🎯 MVP

**Goal**: DevOps engineer can send a notification to Teams channel when CI/CD pipeline completes

**Independent Test**: Trigger action with valid credentials and simple message body, verify message appears in Teams

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T016 [P] [US1] Create auth service unit tests for token acquisition in **tests**/auth.test.ts
- [ ] T017 [P] [US1] Create notify service unit tests for webhook POST in **tests**/notify.test.ts
- [ ] T018 [P] [US1] Create main integration tests for successful notification flow in **tests**/main.test.ts

### Implementation for User Story 1

- [ ] T019 [US1] Implement OAuth2 token acquisition via POST to Microsoft endpoint in src/auth.ts
- [ ] T020 [US1] Implement token response parsing and error handling in src/auth.ts
- [ ] T021 [US1] Implement notification POST with Bearer token header in src/notify.ts
- [ ] T022 [US1] Implement HTTP 202 success handling in src/notify.ts
- [ ] T023 [US1] Wire auth and notify services into main run() function in src/main.ts
- [ ] T024 [US1] Implement structured outputs (notification_sent, response_code, duration_ms) in src/main.ts
- [ ] T025 [US1] Add secret masking for client_secret and access_token in src/main.ts

**Checkpoint**: User Story 1 is fully functional - can send basic notifications to Teams

---

## Phase 4: User Story 2 - Handle Authentication Failures Gracefully (Priority: P1)

**Goal**: DevOps engineer receives clear, actionable error messages when auth fails

**Independent Test**: Provide invalid credentials and verify specific error message (not generic HTTP error)

### Tests for User Story 2

- [ ] T026 [P] [US2] Create auth error handling tests for invalid_client in **tests**/auth.test.ts
- [ ] T027 [P] [US2] Create auth error handling tests for tenant_not_found in **tests**/auth.test.ts
- [ ] T028 [P] [US2] Create auth error handling tests for invalid_grant in **tests**/auth.test.ts

### Implementation for User Story 2

- [ ] T029 [US2] Parse Microsoft error response format (error, error_description) in src/auth.ts
- [ ] T030 [US2] Map error codes to actionable messages per spec acceptance scenarios in src/auth.ts
- [ ] T031 [US2] Implement error_message output population in src/main.ts
- [ ] T032 [US2] Ensure secrets are never logged in error messages in src/auth.ts

**Checkpoint**: User Stories 1 AND 2 are independently functional - MVP complete

---

## Phase 5: User Story 3 - Convenience Parameters for Common Messages (Priority: P2)

**Goal**: DevOps engineer can send common notification types without constructing JSON manually

**Independent Test**: Use status and title params (no body), verify formatted card appears in Teams

### Tests for User Story 3

- [ ] T033 [P] [US3] Create payload construction tests for success status in **tests**/payload.test.ts
- [ ] T034 [P] [US3] Create payload construction tests for failure status in **tests**/payload.test.ts
- [ ] T035 [P] [US3] Create payload construction tests for body precedence in **tests**/payload.test.ts

### Implementation for User Story 3

- [ ] T036 [US3] Create payload builder module structure in src/payload.ts
- [ ] T037 [US3] Implement Adaptive Card generation for success status in src/payload.ts
- [ ] T038 [US3] Implement Adaptive Card generation for failure status in src/payload.ts
- [ ] T039 [US3] Implement Adaptive Card generation for cancelled status in src/payload.ts
- [ ] T040 [US3] Implement body vs convenience parameter precedence logic in src/payload.ts
- [ ] T041 [US3] Add warning log when both body and convenience params provided in src/payload.ts
- [ ] T042 [US3] Wire payload builder into main flow in src/main.ts

**Checkpoint**: User Story 3 complete - convenience parameters working

---

## Phase 6: User Story 4 - Retry on Transient Network Failures (Priority: P2)

**Goal**: Action automatically retries on temporary network issues

**Independent Test**: Simulate network timeout, verify retry with backoff, check retry_count output

### Tests for User Story 4

- [ ] T043 [P] [US4] Create retry logic tests for success after failure in **tests**/retry.test.ts
- [ ] T044 [P] [US4] Create retry logic tests for max retries exhausted in **tests**/retry.test.ts
- [ ] T045 [P] [US4] Create retry logic tests for fail_on_error behavior in **tests**/retry.test.ts

### Implementation for User Story 4

- [ ] T046 [US4] Implement exponential backoff utility (1s→2s→4s with jitter) in src/retry.ts
- [ ] T047 [US4] Implement retry wrapper for HTTP operations in src/retry.ts
- [ ] T048 [US4] Implement retry_count output tracking in src/retry.ts
- [ ] T049 [US4] Wire retry logic into notify service in src/notify.ts
- [ ] T050 [US4] Implement fail_on_error flag handling (default: false) in src/main.ts
- [ ] T051 [US4] Implement Retry-After header respect for 429 responses in src/retry.ts

**Checkpoint**: User Story 4 complete - retry logic working

---

## Phase 7: User Story 5 - Validate and Dry-Run in Pull Requests (Priority: P2)

**Goal**: DevOps engineer can validate configuration in PRs without sending actual messages

**Independent Test**: Run with dry_run: true, verify no HTTP requests, payload logged with secrets redacted

### Tests for User Story 5

- [ ] T052 [P] [US5] Create dry-run tests for valid inputs in **tests**/main.test.ts
- [ ] T053 [P] [US5] Create dry-run tests for invalid body detection in **tests**/main.test.ts
- [ ] T054 [P] [US5] Create dry-run tests for secret redaction in logs in **tests**/main.test.ts

### Implementation for User Story 5

- [ ] T055 [US5] Implement dry_run mode bypass of HTTP calls in src/main.ts
- [ ] T056 [US5] Implement payload logging with secret redaction in src/main.ts
- [ ] T057 [US5] Implement skip_reason: dry_run output in src/main.ts
- [ ] T058 [US5] Ensure validation runs before dry-run log in src/main.ts

**Checkpoint**: User Story 5 complete - dry-run mode working

---

## Phase 8: User Story 6 - Prevent Duplicate Notifications (Priority: P3)

**Goal**: Avoid duplicate notifications when workflows are re-run

**Independent Test**: Run same action twice with identical context, verify second is skipped

### Tests for User Story 6

- [ ] T059 [P] [US6] Create deduplication tests for duplicate detection in **tests**/main.test.ts
- [ ] T060 [P] [US6] Create deduplication tests for re-run (different attempt) in **tests**/main.test.ts

### Implementation for User Story 6

- [ ] T061 [US6] Create deduplication key from {repository, run_id, job_name, attempt_number} in src/main.ts
- [ ] T062 [US6] Implement 60-second deduplication window using GitHub context in src/main.ts
- [ ] T063 [US6] Implement skip_reason: duplicate output in src/main.ts
- [ ] T064 [US6] Add @actions/github dependency for context access in src/main.ts

**Checkpoint**: User Story 6 complete - deduplication working

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T065 [P] Create README.md with usage examples from quickstart.md
- [ ] T066 [P] Add JSDoc comments to all public functions in src/*.ts
- [ ] T067 Run Rollup build and verify dist/index.js output
- [ ] T068 [P] Create .github/workflows/test.yml for CI (npm test)
- [ ] T069 [P] Create .github/workflows/release.yml for automated releases
- [ ] T070 Run quickstart.md examples as smoke tests
- [ ] T071 Final security review: grep for secret leakage in all source files
- [ ] T072 Verify all constitution principles are satisfied

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1, US2 are P1 priorities - implement first (MVP)
  - US3, US4, US5 are P2 priorities - implement after MVP
  - US6 is P3 priority - implement last
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Can Parallelize With |
|-------|----------|--------------|---------------------|
| US1 (Basic Notification) | P1 | Foundation only | US2 (after T019-T025) |
| US2 (Auth Error Handling) | P1 | Foundation only | US1 (after T029-T032) |
| US3 (Convenience Params) | P2 | US1 complete | US4, US5, US6 |
| US4 (Retry Logic) | P2 | US1 complete | US3, US5, US6 |
| US5 (Dry-Run Mode) | P2 | Foundation only | US3, US4, US6 |
| US6 (Deduplication) | P3 | US1 complete | US3, US4, US5 |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Core logic before integration
3. Integration before outputs
4. Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T003, T004, T005, T006 can run in parallel
- **Phase 2**: T008, T009, T010 and T011, T012, T013 can run in parallel
- **Per User Story**: All tests marked [P] can run in parallel within that story

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "Create auth service unit tests for token acquisition in __tests__/auth.test.ts"
Task: "Create notify service unit tests for webhook POST in __tests__/notify.test.ts"
Task: "Create main integration tests for successful notification flow in __tests__/main.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Basic Notification)
4. Complete Phase 4: User Story 2 (Auth Error Handling)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready - this is a working MVP!

### Incremental Delivery

| Increment | User Stories | Value Delivered |
|-----------|--------------|-----------------|
| MVP | US1 + US2 | Send notifications with good error handling |
| v1.1 | + US3 | Convenience parameters for common cases |
| v1.2 | + US4 + US5 | Production-ready with retries and dry-run |
| v1.3 | + US6 | Polished with deduplication |

### Single Developer Path

1. Setup → Foundation → US1 → US2 (MVP in ~4-6 hours)
2. US3 → US4 → US5 → US6 (Complete in ~4-6 additional hours)
3. Polish (~1-2 hours)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All secrets must be masked before any logging (FR-014, FR-016)
- HTTPS validation is non-negotiable (FR-015)
