/**
 * Payload construction for MS Teams Webhook Action
 * Builds Adaptive Cards from convenience parameters
 *
 * @module payload
 */

import type { MessageInputs } from './types.js'

// =============================================================================
// Constants
// =============================================================================

/**
 * Adaptive Card color styles mapped to build status
 */
export const STATUS_COLORS: Record<string, string> = {
  success: 'Good',
  failure: 'Attention',
  cancelled: 'Warning',
}

/**
 * Status icons with visual indicators
 */
export const STATUS_ICONS: Record<string, string> = {
  success: '✓ Success',
  failure: '✗ Failed',
  cancelled: '⊘ Cancelled',
}

/**
 * Default titles for each status type
 */
const DEFAULT_TITLES: Record<string, string> = {
  success: 'Build Succeeded',
  failure: 'Build Failed',
  cancelled: 'Build Cancelled',
}

// =============================================================================
// Types
// =============================================================================

/**
 * Adaptive Card structure for MS Teams
 */
export interface AdaptiveCard {
  $schema: string
  type: 'AdaptiveCard'
  version: string
  msteams?: { width: string }
  body: AdaptiveCardElement[]
  actions?: AdaptiveCardAction[]
}

/**
 * Adaptive Card elements we generate
 */
export type AdaptiveCardElement =
  | TextBlockElement
  | FactSetElement
  | ContainerElement

interface TextBlockElement {
  type: 'TextBlock'
  text: string
  weight?: 'Default' | 'Bolder' | 'Lighter'
  size?: 'Default' | 'Small' | 'Medium' | 'Large' | 'ExtraLarge'
  wrap?: boolean
  style?: 'default' | 'heading'
  color?: string
}

interface FactSetElement {
  type: 'FactSet'
  facts: Array<{ title: string; value: string }>
}

interface ContainerElement {
  type: 'Container'
  items: AdaptiveCardElement[]
  style?: string
}

/**
 * Adaptive Card actions
 */
export type AdaptiveCardAction = ActionOpenUrl

interface ActionOpenUrl {
  type: 'Action.OpenUrl'
  title: string
  url: string
}

/**
 * Result from payload construction
 */
export interface PayloadResult {
  /** The constructed payload */
  payload: Record<string, unknown>
  /** Whether explicit body was used (vs convenience params) */
  usedBody: boolean
  /** Warning message if both body and convenience params provided */
  warning?: string
}

/**
 * Convenience parameters for building a card
 */
export interface ConvenienceParams {
  status?: 'success' | 'failure' | 'cancelled'
  title?: string
  summary?: string
  repository?: string
  run_url?: string
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build a notification payload from action inputs.
 *
 * If `body` is provided and non-empty, it is parsed and used directly.
 * Otherwise, convenience parameters are used to build an Adaptive Card.
 *
 * @param inputs - Message inputs from action
 * @returns Payload result with constructed payload and metadata
 */
export function buildPayload(inputs: MessageInputs): PayloadResult {
  // Check if explicit body is provided
  if (inputs.body && inputs.body.trim() !== '') {
    const payload = JSON.parse(inputs.body) as Record<string, unknown>

    // Check if convenience params were also provided (generate warning)
    const hasConvenienceParams =
      inputs.status !== undefined ||
      inputs.title !== undefined ||
      inputs.summary !== undefined ||
      inputs.repository !== undefined ||
      inputs.run_url !== undefined

    return {
      payload,
      usedBody: true,
      warning: hasConvenienceParams
        ? 'body parameter provided; convenience parameters (status, title, etc.) will be ignored'
        : undefined,
    }
  }

  // Build Adaptive Card from convenience parameters
  const card = buildAdaptiveCard({
    status: inputs.status,
    title: inputs.title,
    summary: inputs.summary,
    repository: inputs.repository,
    run_url: inputs.run_url,
  })

  return {
    payload: card as unknown as Record<string, unknown>,
    usedBody: false,
  }
}

/**
 * Build an Adaptive Card from convenience parameters.
 *
 * @param params - Convenience parameters
 * @returns Adaptive Card structure
 */
export function buildAdaptiveCard(params: ConvenienceParams): AdaptiveCard {
  const status = params.status ?? 'success'
  const title = params.title ?? DEFAULT_TITLES[status] ?? 'Notification'
  const color = STATUS_COLORS[status] ?? 'Default'
  const icon = STATUS_ICONS[status] ?? ''

  const body: AdaptiveCardElement[] = []

  body.push({
    type: 'TextBlock',
    text: `${icon}: ${title}`,
    weight: 'Bolder',
    size: 'Large',
    wrap: true,
    style: 'heading',
    color,
  })

  if (params.summary) {
    body.push({
      type: 'TextBlock',
      text: params.summary,
      wrap: true,
    })
  }

  const facts: Array<{ title: string; value: string }> = []

  if (params.repository) {
    facts.push({ title: 'Repository', value: params.repository })
  }

  if (facts.length > 0) {
    body.push({
      type: 'FactSet',
      facts,
    })
  }

  const card: AdaptiveCard = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    msteams: { width: 'Full' },
    body,
  }

  if (params.run_url) {
    card.actions = [
      {
        type: 'Action.OpenUrl',
        title: 'View Details',
        url: params.run_url,
      },
    ]
  }

  return card
}
