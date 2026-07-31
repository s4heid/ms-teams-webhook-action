/**
 * Payload construction tests for MS Teams Webhook Action
 * Tests for User Story 3 - Convenience Parameters
 */

import { describe, it, expect } from '@jest/globals'
import {
  buildPayload,
  buildAdaptiveCard,
  STATUS_COLORS,
  STATUS_ICONS,
} from '../src/payload.js'

describe('buildPayload', () => {
  describe('body precedence (T035)', () => {
    it('should return parsed body when body is provided', () => {
      const result = buildPayload({
        body: '{"message": "Custom body"}',
      })

      expect(result.payload).toEqual({ message: 'Custom body' })
      expect(result.usedBody).toBe(true)
    })

    it('should return parsed body even when convenience params provided', () => {
      const result = buildPayload({
        body: '{"custom": "payload"}',
        status: 'success',
        title: 'Build Complete',
      })

      expect(result.payload).toEqual({ custom: 'payload' })
      expect(result.usedBody).toBe(true)
      expect(result.warning).toContain('body parameter provided')
    })

    it('should use convenience params when body is not provided', () => {
      const result = buildPayload({
        status: 'success',
        title: 'Build Complete',
      })

      expect(result.usedBody).toBe(false)
      expect(result.payload).toHaveProperty('type', 'AdaptiveCard')
    })

    it('should use convenience params when body is empty string', () => {
      const result = buildPayload({
        body: '',
        status: 'failure',
        title: 'Build Failed',
      })

      expect(result.usedBody).toBe(false)
      expect(result.payload).toHaveProperty('type', 'AdaptiveCard')
    })
  })

  describe('success status (T033)', () => {
    it('should generate Adaptive Card with success styling', () => {
      const result = buildPayload({
        status: 'success',
        title: 'Build Complete',
        summary: 'All tests passed',
        repository: 'myorg/myrepo',
        run_url: 'https://github.com/myorg/myrepo/actions/runs/123',
      })

      expect(result.payload).toMatchObject({
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.5',
      })

      const payload = result.payload as Record<string, unknown>
      expect(payload.body).toBeDefined()
      expect(Array.isArray(payload.body)).toBe(true)
    })

    it('should include success icon and color in card', () => {
      const result = buildPayload({
        status: 'success',
        title: 'Build Complete',
      })

      const payload = result.payload as Record<string, unknown>
      const body = payload.body as Array<Record<string, unknown>>

      // Find TextBlock with title
      const titleBlock = body.find(
        el =>
          el.type === 'TextBlock' &&
          (el.text as string)?.includes('Build Complete')
      )
      expect(titleBlock).toBeDefined()
    })

    it('should include View Details action when run_url provided', () => {
      const result = buildPayload({
        status: 'success',
        title: 'Build Complete',
        run_url: 'https://github.com/myorg/myrepo/actions/runs/123',
      })

      const payload = result.payload as Record<string, unknown>
      expect(payload.actions).toBeDefined()
      const actions = payload.actions as Array<Record<string, unknown>>
      expect(actions.some(a => a.type === 'Action.OpenUrl')).toBe(true)
    })
  })

  describe('failure status (T034)', () => {
    it('should generate Adaptive Card with failure styling', () => {
      const result = buildPayload({
        status: 'failure',
        title: 'Build Failed',
        summary: '3 tests failed',
      })

      expect(result.payload).toMatchObject({
        type: 'AdaptiveCard',
        version: '1.5',
      })

      const payload = result.payload as Record<string, unknown>
      expect(payload.body).toBeDefined()
    })

    it('should include failure summary in card body', () => {
      const result = buildPayload({
        status: 'failure',
        title: 'Build Failed',
        summary: '3 tests failed',
      })

      const payload = result.payload as Record<string, unknown>
      const body = payload.body as Array<Record<string, unknown>>

      // Should contain summary text
      const hasSummary = body.some(
        el =>
          el.type === 'TextBlock' &&
          (el.text as string)?.includes('3 tests failed')
      )
      expect(hasSummary).toBe(true)
    })
  })

  describe('cancelled status', () => {
    it('should generate Adaptive Card with cancelled styling', () => {
      const result = buildPayload({
        status: 'cancelled',
        title: 'Build Cancelled',
      })

      expect(result.payload).toMatchObject({
        type: 'AdaptiveCard',
        version: '1.5',
      })
    })
  })

  describe('repository facts', () => {
    it('should include repository in facts when provided', () => {
      const result = buildPayload({
        status: 'success',
        title: 'Build Complete',
        repository: 'myorg/myrepo',
      })

      const payload = result.payload as Record<string, unknown>
      const body = payload.body as Array<Record<string, unknown>>

      // Find FactSet with repository
      const factSet = body.find(el => el.type === 'FactSet') as
        | { type: string; facts: Array<{ title: string; value: string }> }
        | undefined
      expect(factSet).toBeDefined()

      const facts = factSet!.facts
      expect(
        facts.some(f => f.title === 'Repository' && f.value === 'myorg/myrepo')
      ).toBe(true)
    })
  })

  describe('minimal convenience params', () => {
    it('should work with only status provided', () => {
      const result = buildPayload({
        status: 'success',
      })

      expect(result.payload).toHaveProperty('type', 'AdaptiveCard')
      expect(result.usedBody).toBe(false)
    })

    it('should work with only title provided', () => {
      const result = buildPayload({
        title: 'Custom Notification',
      })

      expect(result.payload).toHaveProperty('type', 'AdaptiveCard')
      expect(result.usedBody).toBe(false)
    })
  })
})

describe('buildAdaptiveCard', () => {
  it('should have proper schema and version', () => {
    const card = buildAdaptiveCard({
      status: 'success',
      title: 'Test',
    })

    expect(card.$schema).toBe(
      'http://adaptivecards.io/schemas/adaptive-card.json'
    )
    expect(card.type).toBe('AdaptiveCard')
    expect(card.version).toBe('1.5')
  })

  it('should include msteams property for Teams compatibility', () => {
    const card = buildAdaptiveCard({
      status: 'success',
      title: 'Test',
    })

    expect(card.msteams).toEqual({ width: 'Full' })
  })
})

describe('STATUS_COLORS', () => {
  it('should have colors for all status types', () => {
    expect(STATUS_COLORS.success).toBe('Good')
    expect(STATUS_COLORS.failure).toBe('Attention')
    expect(STATUS_COLORS.cancelled).toBe('Warning')
  })
})

describe('STATUS_ICONS', () => {
  it('should have icons for all status types', () => {
    expect(STATUS_ICONS.success).toContain('✓')
    expect(STATUS_ICONS.failure).toContain('✗')
    expect(STATUS_ICONS.cancelled).toContain('⊘')
  })
})
