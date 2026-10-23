import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { spawn } from 'node:child_process'
import { z } from 'zod'

const MODEL = 'claude-opus-5'
// Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

type Effort = 'low' | 'medium' | 'high'

/**
 * "api" calls the Anthropic API with a Console key (sk-ant-api...). Required for anything deployed.
 * "claude-cli" runs local `claude -p` on the developer's own Claude Code login: a stopgap for
 * prototyping on your own machine only, never for a shared or hosted app.
 */
export const LLM_BACKEND =
  process.env.LLM_BACKEND ?? (process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-api') ? 'api' : 'claude-cli')

let anthropic: Anthropic | null = null

async function askApi<T extends z.ZodType>(schema: T, system: string, user: string, effort: Effort, maxTokens: number) {
  anthropic ??= new Anthropic()
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    ...FALLBACK,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: 'user', content: user }],
  })
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('Claude returned no answer')
  return response.parsed_output as z.infer<T>
}

function askCli<T extends z.ZodType>(schema: T, system: string, user: string, effort: Effort): Promise<z.infer<T>> {
  // The CLI's validator rejects zod's draft-2020-12 "$schema" header, so drop it.
  const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema)
  const args = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--safe-mode',
    '--strict-mcp-config',
    '--tools', '',
    '--model', 'opus',
    '--effort', effort,
    '--system-prompt', system,
    '--json-schema', JSON.stringify(jsonSchema),
  ]
  // Drop API credentials from .env so the CLI uses its own login, and the nested-session marker.
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.CLAUDECODE

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill(), 180_000)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => reject(new Error(`Could not start claude CLI: ${e.message}`)))
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        const result = JSON.parse(out)
        if (result.is_error || !result.structured_output) throw new Error(result.result ?? 'no structured output')
        resolve(schema.parse(result.structured_output))
      } catch (e) {
        reject(new Error(`claude CLI failed (exit ${code}): ${e instanceof Error ? e.message : e} ${err.slice(0, 300)}`))
      }
    })
    child.stdin.end(user)
  })
}

/** One structured-output call to Claude, via the API or the local Claude Code CLI. */
export function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  { effort = 'medium', maxTokens = 8000 }: { effort?: Effort; maxTokens?: number } = {},
): Promise<z.infer<T>> {
  return LLM_BACKEND === 'api' ? askApi(schema, system, user, effort, maxTokens) : askCli(schema, system, user, effort)
}
