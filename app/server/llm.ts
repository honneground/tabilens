import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

const MODEL = 'claude-opus-5'
// Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

type Effort = 'low' | 'medium' | 'high'

/**
 * "api" calls the Anthropic API with a Console key (sk-ant-api...). Required for anything deployed.
 * "claude-cli" runs local `claude -p` on the developer's own Claude Code login: a stopgap for
 * prototyping on your own machine only, never for a shared or hosted app.
 * "antigravity" runs local `agy -p` using the active Antigravity session.
 */
const configuredBackend =
  process.env.LLM_BACKEND ?? (process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-api') ? 'api' : 'claude-cli')
if (!['api', 'claude-cli', 'antigravity'].includes(configuredBackend)) {
  throw new Error('LLM_BACKEND must be api, claude-cli, or antigravity')
}
export const LLM_BACKEND = configuredBackend

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

function resolveAgyBin() {
  if (process.env.AGY_PATH) return process.env.AGY_PATH
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const executable = path.join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.EXE')
    if (existsSync(executable)) return executable
  }
  return 'agy'
}

function askAgy<T extends z.ZodType>(schema: T, system: string, user: string, effort: Effort): Promise<z.infer<T>> {
  const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema)
  const model = process.env.AGY_MODEL || 'gemini-3.8-flash-low'
  const args = [
    '--mode', 'plan',
    '--disable-slash-commands',
    '--model', model,
    '--effort', model.includes('-low') ? 'low' : effort,
    '--output-format', 'json',
    '--json-schema', JSON.stringify(jsonSchema),
    '-p', `Instructions:\n${system}\n\nTask Input:\n${user}`,
  ]

  return new Promise((resolve, reject) => {
    const child = spawn(resolveAgyBin(), args, { stdio: ['pipe', 'pipe', 'pipe'], shell: false })
    let out = ''
    let settled = false
    const finishError = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    }
    const timer = setTimeout(() => {
      finishError(new Error('Antigravity CLI timed out'))
      child.kill()
    }, 60_000)
    child.stdout.on('data', (data) => { out += data })
    // Drain stderr without returning raw process output to the browser.
    child.stderr.on('data', () => {})
    child.on('error', () => finishError(new Error('Could not start Antigravity CLI. Check AGY_PATH or install agy.')))
    child.stdin.on('error', () => finishError(new Error('Could not send input to Antigravity CLI')))
    child.on('close', (code) => {
      if (settled) return
      if (code !== 0) return finishError(new Error(`Antigravity CLI failed (exit ${code})`))
      try {
        const result = JSON.parse(out)
        if (result.is_error || result.error) throw new Error('Antigravity returned an error')
        const output = result.structured_output ?? result.response ?? result.result
        if (output === undefined || output === null) throw new Error('No structured output returned')
        const parsed = schema.parse(typeof output === 'string' ? JSON.parse(output) : output)
        settled = true
        clearTimeout(timer)
        resolve(parsed)
      } catch {
        finishError(new Error('Antigravity CLI returned invalid structured output'))
      }
    })
    child.stdin.end()
  })
}

/** One structured-output call through the selected Claude or Antigravity backend. */
export function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  { effort = 'medium', maxTokens = 8000 }: { effort?: Effort; maxTokens?: number } = {},
): Promise<z.infer<T>> {
  if (LLM_BACKEND === 'api') return askApi(schema, system, user, effort, maxTokens)
  if (LLM_BACKEND === 'claude-cli') return askCli(schema, system, user, effort)
  return askAgy(schema, system, user, effort)
}
