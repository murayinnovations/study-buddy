import Anthropic from '@anthropic-ai/sdk'

// Model and effort for Arthur. Override with ARTHUR_MODEL / ARTHUR_EFFORT
// (e.g. ARTHUR_MODEL=claude-opus-5-5, ARTHUR_EFFORT=medium) to compare quality.
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = typeof EFFORTS[number]

export const MODEL = process.env.ARTHUR_MODEL || 'claude-sonnet-5-5'
export const EFFORT: Effort = (EFFORTS as readonly string[]).includes(process.env.ARTHUR_EFFORT || '')
  ? process.env.ARTHUR_EFFORT as Effort
  : 'low'

// If a safety classifier declines, retry server-side on Anthropic's recommended model.
export const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: 'default' } = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
}

let client: Anthropic | null = null

// Created on first use so a missing key returns a clean error instead of failing at import.
export function getClient() {
  client ??= new Anthropic()
  return client
}

// One line per Claude call, so rehearsals show what each message really costs.
export function logUsage(route: string, effort: Effort, usage: Anthropic.Beta.BetaUsage, extra = '') {
  const cached = usage.cache_read_input_tokens ?? 0
  const written = usage.cache_creation_input_tokens ?? 0
  const total = usage.input_tokens + cached + written
  console.log(
    `[claude] ${route} ${MODEL}/${effort}${extra}: input ${total} ` +
    `(cached ${cached}, cache write ${written}, uncached ${usage.input_tokens}) · output ${usage.output_tokens}`,
  )
}
