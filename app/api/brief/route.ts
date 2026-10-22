import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod/v4'
import { MODEL, FALLBACK, getClient, logUsage } from '../../lib/claude'
import { requireMember } from '../../lib/auth'

// Drafts the lecturer's next tutorial plan from the class's learning signals.

// Drafts by input, so asking again with unchanged class data costs nothing.
// Per server instance; cleared on restart.
const drafts = new Map<string, { items: unknown; generatedAt: number }>()
const MAX_DRAFTS = 50

const BriefInput = z.object({
  course: z.string().max(100),
  week: z.number().int().min(1).max(20),
  topics: z.array(z.object({ topic: z.string().max(100), confusion: z.number(), avg: z.number() })).max(20),
  questions: z.array(z.string().max(1000)).max(10),
  misconceptions: z.array(z.string().max(300)).max(15),
  refresh: z.boolean().optional(),
})

const Brief = z.object({
  items: z.array(z.object({
    topic: z.string().describe('Short title for this part of the session'),
    focus: z.string().describe('One or two sentences: what students are getting wrong and what to do about it in class'),
    minutes: z.number().int(),
  })),
})

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'Arthur is not configured yet.' }, { status: 500 })
  const member = await requireMember('lecturer')
  if (member instanceof Response) return member

  let input: z.infer<typeof BriefInput>
  try {
    input = BriefInput.parse(await req.json())
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { refresh, ...data } = input
  const key = JSON.stringify(data)
  const cached = drafts.get(key)
  if (cached && !refresh) return Response.json({ ...cached, cached: true })

  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low', format: betaZodOutputFormat(Brief) },
      ...FALLBACK,
      system: 'You help university lecturers plan a 60-minute tutorial from what their students are struggling with. Be specific and practical. Write for the lecturer, in plain language.',
      messages: [{
        role: 'user',
        content: `Plan the next ${input.course} tutorial (Week ${input.week}).

Confusion rate is the share of students below 50% mastery on a topic.

Topics, most confused first:
${input.topics.map(t => `- ${t.topic}: ${t.confusion}% confused, class average ${t.avg}%`).join('\n')}

Misconceptions Arthur noticed in student chats this week:
${input.misconceptions.map(m => `- ${m}`).join('\n') || '- none recorded'}

Recent questions students sent to the lecturer:
${input.questions.map(q => `- ${q}`).join('\n') || '- none'}

Return 3 or 4 items whose minutes add up to 60. Spend the most time on the most confused topics, address the misconceptions directly, and end with a short open Q&A item.`,
      }],
    })
    logUsage('brief', 'low', response.usage)
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return Response.json({ error: 'Arthur could not draft a brief this time.' }, { status: 502 })
    }
    const draft = { items: response.parsed_output.items, generatedAt: Date.now() }
    if (drafts.size >= MAX_DRAFTS) drafts.delete(drafts.keys().next().value!)
    drafts.set(key, draft)
    return Response.json({ ...draft, cached: false })
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`Claude API error ${err.status}:`, err.message)
    else console.error('Brief failed:', err)
    return Response.json({ error: 'Arthur could not draft a brief this time.' }, { status: 502 })
  }
}
