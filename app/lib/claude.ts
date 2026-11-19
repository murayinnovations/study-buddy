import Anthropic from '@anthropic-ai/sdk'

// Model and effort for Study Buddy. Override with STUDY_BUDDY_MODEL / STUDY_BUDDY_EFFORT
// (e.g. STUDY_BUDDY_MODEL=claude-opus-5-5, STUDY_BUDDY_EFFORT=medium) to compare quality.
// The names from before the rename (CURRICULUM_AI_MODEL / _EFFORT) still work.
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = typeof EFFORTS[number]

const effortSetting = process.env.STUDY_BUDDY_EFFORT || process.env.CURRICULUM_AI_EFFORT || ''
export const MODEL = process.env.STUDY_BUDDY_MODEL || process.env.CURRICULUM_AI_MODEL || 'claude-sonnet-5-5'
export const EFFORT: Effort = (EFFORTS as readonly string[]).includes(effortSetting) ? effortSetting as Effort : 'low'

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
