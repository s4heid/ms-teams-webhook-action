# Quickstart: MS Teams Webhook Notification Action

**Phase**: 1 - Design & Contracts  
**Date**: 2026-01-08  
**Plan**: [plan.md](./plan.md)

## Prerequisites

1. **Azure AD App Registration** with:
   - Client ID
   - Client Secret
   - Tenant ID
   - API permission: `https://service.flow.microsoft.com//.default`

2. **Power Automate Webhook** configured to:
   - Accept HTTP POST requests
   - Require Azure AD authentication
   - Post to your Teams channel

3. **GitHub Repository Secrets**:
   - `TEAMS_CLIENT_ID`
   - `TEAMS_CLIENT_SECRET`
   - `TEAMS_TENANT_ID`
   - `TEAMS_WEBHOOK_URL`

## Basic Usage

### Simple Message

```yaml
name: Notify Teams

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Send Teams Notification
        uses: your-org/ms-teams-webhook-action@v1
        with:
          client_id: ${{ secrets.TEAMS_CLIENT_ID }}
          client_secret: ${{ secrets.TEAMS_CLIENT_SECRET }}
          tenant_id: ${{ secrets.TEAMS_TENANT_ID }}
          webhook_url: ${{ secrets.TEAMS_WEBHOOK_URL }}
          body: '{"message": "Build completed for ${{ github.repository }}"}'
```

### Convenience Parameters

```yaml
- name: Send Build Status
  uses: your-org/ms-teams-webhook-action@v1
  with:
    client_id: ${{ secrets.TEAMS_CLIENT_ID }}
    client_secret: ${{ secrets.TEAMS_CLIENT_SECRET }}
    tenant_id: ${{ secrets.TEAMS_TENANT_ID }}
    webhook_url: ${{ secrets.TEAMS_WEBHOOK_URL }}
    status: ${{ job.status }}
    title: 'Build ${{ job.status }}'
    summary: 'Commit ${{ github.sha }} by ${{ github.actor }}'
    repository: ${{ github.repository }}
    run_url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

### Custom Adaptive Card

```yaml
- name: Send Adaptive Card
  uses: your-org/ms-teams-webhook-action@v1
  with:
    client_id: ${{ secrets.TEAMS_CLIENT_ID }}
    client_secret: ${{ secrets.TEAMS_CLIENT_SECRET }}
    tenant_id: ${{ secrets.TEAMS_TENANT_ID }}
    webhook_url: ${{ secrets.TEAMS_WEBHOOK_URL }}
    body: |
      {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.5",
        "body": [
          {
            "type": "TextBlock",
            "text": "🚀 Deployment Complete",
            "weight": "Bolder",
            "size": "Large"
          },
          {
            "type": "FactSet",
            "facts": [
              { "title": "Environment", "value": "Production" },
              { "title": "Version", "value": "${{ github.ref_name }}" }
            ]
          }
        ]
      }
```

## Dry-Run Mode (for PRs)

```yaml
name: PR Validation

on:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Validate Notification Config
        uses: your-org/ms-teams-webhook-action@v1
        with:
          client_id: ${{ secrets.TEAMS_CLIENT_ID }}
          client_secret: ${{ secrets.TEAMS_CLIENT_SECRET }}
          tenant_id: ${{ secrets.TEAMS_TENANT_ID }}
          webhook_url: ${{ secrets.TEAMS_WEBHOOK_URL }}
          status: success
          title: 'PR Validation'
          dry_run: true  # No actual message sent
```

## Handling Failures

### Don't fail the build (default)

```yaml
- name: Send Notification
  uses: your-org/ms-teams-webhook-action@v1
  with:
    # ... credentials ...
    status: ${{ job.status }}
    fail_on_error: false  # Default - notification failure won't fail the build
```

### Fail the build on notification failure

```yaml
- name: Critical Alert
  uses: your-org/ms-teams-webhook-action@v1
  with:
    # ... credentials ...
    body: '{"message": "CRITICAL: Production deployment failed!"}'
    fail_on_error: true  # Notification failure will fail the build
```

## Using Action Outputs

```yaml
- name: Send Notification
  id: notify
  uses: your-org/ms-teams-webhook-action@v1
  with:
    # ... inputs ...

- name: Check Result
  run: |
    echo "Sent: ${{ steps.notify.outputs.notification_sent }}"
    echo "Response: ${{ steps.notify.outputs.response_code }}"
    echo "Retries: ${{ steps.notify.outputs.retry_count }}"
    echo "Duration: ${{ steps.notify.outputs.duration_ms }}ms"
```

## Complete Example: CI/CD Pipeline

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: npm ci && npm run build

      - name: Test
        run: npm test

  notify:
    needs: build
    runs-on: ubuntu-latest
    if: always()  # Run even if build fails
    steps:
      - name: Send Teams Notification
        uses: your-org/ms-teams-webhook-action@v1
        with:
          client_id: ${{ secrets.TEAMS_CLIENT_ID }}
          client_secret: ${{ secrets.TEAMS_CLIENT_SECRET }}
          tenant_id: ${{ secrets.TEAMS_TENANT_ID }}
          webhook_url: ${{ secrets.TEAMS_WEBHOOK_URL }}
          status: ${{ needs.build.result }}
          title: '${{ github.repository }} - ${{ needs.build.result }}'
          summary: |
            Branch: ${{ github.ref_name }}
            Commit: ${{ github.sha }}
            Author: ${{ github.actor }}
          repository: ${{ github.repository }}
          run_url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          dry_run: ${{ github.event_name == 'pull_request' }}
```

## Troubleshooting

### Authentication Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Invalid client credentials" | Wrong client_secret | Verify secret value in Azure portal |
| "Tenant not found" | Wrong tenant_id | Check tenant ID or domain |
| "Application not found" | Wrong client_id or app disabled | Verify app registration exists |

### Network Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Notification failed after 3 retries" | Webhook unreachable | Check webhook URL and network |
| "Request timeout" | Slow response | Increase `timeout` value |

### Validation Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "webhook_url must be HTTPS" | HTTP URL provided | Use HTTPS URL |
| "body must be valid JSON" | Malformed JSON | Validate JSON syntax |
| "Either body or convenience parameters required" | No message content | Provide body or status/title |
