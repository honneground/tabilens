import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import vm from 'node:vm'
import ts from 'typescript'
import { z } from 'zod'

const require = createRequire(import.meta.url)
const schema = z.object({ answer: z.string() })
const source = readFileSync(new URL('../server/llm.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } })

// Exercise routing and process contracts without model requests or account usage.
function harness({ env = {}, envelope = { structured_output: { answer: 'ok' } }, raw, exitCode = 0, spawnError = false, hold = false, apiResponse = { stop_reason: 'end_turn', parsed_output: { answer: 'api' } } } = {}) {
  const calls = []
  const apiCalls = []
  const timers = new Set()
  let killed = false
  class Anthropic {
    beta = { messages: { parse: async (request) => { apiCalls.push(request); return apiResponse } } }
  }
  const spawn = (binary, args, options) => {
    const child = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.stdin = new PassThrough()
    child.kill = () => { killed = true; child.emit('close', null) }
    calls.push({ binary, args, options, child })
    queueMicrotask(() => {
      if (hold) return
      if (spawnError) child.emit('error', new Error('Executable unavailable'))
      else child.stdout.end(raw ?? JSON.stringify(envelope))
      child.emit('close', spawnError ? 1 : exitCode)
    })
    return child
  }
  const exports = {}
  vm.runInNewContext(outputText, {
    exports,
    process: { env, platform: 'linux' },
    setTimeout: (fn, ms) => { const timer = { fn, ms }; timers.add(timer); return timer },
    clearTimeout: (timer) => timers.delete(timer),
    require: (id) => {
      if (id === '@anthropic-ai/sdk') return { __esModule: true, default: Anthropic }
      if (id === '@anthropic-ai/sdk/helpers/beta/zod') return { betaZodOutputFormat: () => ({ type: 'json_schema' }) }
      if (id === 'node:child_process') return { spawn }
      if (id === 'node:path') return { __esModule: true, default: require('node:path') }
      return require(id)
    },
  })
  return { ...exports, calls, apiCalls, timers, wasKilled: () => killed }
}

test('default Claude routing is preserved and unknown backends fail explicitly', () => {
  assert.equal(harness().LLM_BACKEND, 'claude-cli')
  assert.equal(harness({ env: { ANTHROPIC_API_KEY: 'sk-ant-api-placeholder' } }).LLM_BACKEND, 'api')
  assert.throws(() => harness({ env: { LLM_BACKEND: 'typo' } }), /LLM_BACKEND must be/)
})

test('Claude API keeps structured-output requests and does not spawn a CLI', async () => {
  const h = harness({ env: { LLM_BACKEND: 'api' } })
  assert.equal((await h.ask(schema, 'Instructions', 'Question', { maxTokens: 100, effort: 'low' })).answer, 'api')
  assert.equal(h.calls.length, 0)
  assert.equal(h.apiCalls[0].max_tokens, 100)
  assert.equal(h.apiCalls[0].messages[0].content, 'Question')
  assert.equal(h.apiCalls[0].output_config.effort, 'low')
})

test('Claude API refusal is still reported', async () => {
  const h = harness({ env: { LLM_BACKEND: 'api' }, apiResponse: { stop_reason: 'refusal', parsed_output: null } })
  await assert.rejects(h.ask(schema, '', ''), /Claude returned no answer/)
})

test('Claude CLI preserves arguments and isolates CLI login from API credentials', async () => {
  const h = harness({ env: { LLM_BACKEND: 'claude-cli', ANTHROPIC_API_KEY: 'placeholder', ANTHROPIC_AUTH_TOKEN: 'placeholder', CLAUDECODE: '1' } })
  assert.equal((await h.ask(schema, 'Instructions', 'Question')).answer, 'ok')
  const call = h.calls[0]
  assert.equal(call.binary, 'claude')
  assert.ok(call.args.includes('--safe-mode'))
  assert.equal(call.options.env.ANTHROPIC_API_KEY, undefined)
  assert.equal(call.options.env.ANTHROPIC_AUTH_TOKEN, undefined)
  assert.equal(call.options.env.CLAUDECODE, undefined)
  assert.equal(call.child.stdin.writableEnded, true)
  assert.equal(h.timers.size, 0)
})

test('Antigravity uses selected executable and model with a structured prompt', async () => {
  const h = harness({ env: { LLM_BACKEND: 'antigravity', AGY_PATH: '/custom path/agy', AGY_MODEL: 'example-model-low' } })
  assert.equal((await h.ask(schema, 'Instructions', 'Question', { effort: 'high' })).answer, 'ok')
  const call = h.calls[0]
  assert.equal(call.binary, '/custom path/agy')
  assert.equal(call.options.shell, false)
  assert.equal(call.args[call.args.indexOf('--mode') + 1], 'plan')
  assert.equal(call.args[call.args.indexOf('--model') + 1], 'example-model-low')
  assert.equal(call.args[call.args.indexOf('--effort') + 1], 'low')
  assert.equal(call.args[call.args.indexOf('-p') + 1], 'Instructions:\nInstructions\n\nTask Input:\nQuestion')
  const requestSchema = JSON.parse(call.args[call.args.indexOf('--json-schema') + 1])
  assert.equal(requestSchema.$schema, undefined)
  assert.equal(requestSchema.properties.answer.type, 'string')
  assert.equal(call.child.stdin.writableEnded, true)
  assert.equal(h.apiCalls.length, 0)
  assert.equal(h.timers.size, 0)
})

test('Antigravity supports response and result JSON envelopes', async () => {
  for (const key of ['response', 'result']) {
    const h = harness({ env: { LLM_BACKEND: 'antigravity', AGY_MODEL: 'example-model' }, envelope: { [key]: '{"answer":"alternate"}' } })
    assert.equal((await h.ask(schema, '', '', { effort: 'high' })).answer, 'alternate')
    assert.equal(h.calls[0].args[h.calls[0].args.indexOf('--effort') + 1], 'high')
  }
})

test('Antigravity rejects invalid, missing, or failed structured responses', async () => {
  for (const envelope of [{ structured_output: { answer: 123 } }, {}, { is_error: true, result: 'Provider failure' }]) {
    const h = harness({ env: { LLM_BACKEND: 'antigravity' }, envelope })
    await assert.rejects(h.ask(schema, '', ''), /invalid structured output/)
    assert.equal(h.timers.size, 0)
  }
  const invalidJson = harness({ env: { LLM_BACKEND: 'antigravity' }, raw: 'not json' })
  await assert.rejects(invalidJson.ask(schema, '', ''), /invalid structured output/)
  const failedProcess = harness({ env: { LLM_BACKEND: 'antigravity' }, exitCode: 2 })
  await assert.rejects(failedProcess.ask(schema, '', ''), /failed \(exit 2\)/)
})

test('Antigravity startup failure and timeout clean up pending work', async () => {
  const missing = harness({ env: { LLM_BACKEND: 'antigravity' }, spawnError: true })
  await assert.rejects(missing.ask(schema, '', ''), /Could not start Antigravity CLI/)
  assert.equal(missing.timers.size, 0)
  const slow = harness({ env: { LLM_BACKEND: 'antigravity' }, hold: true })
  const rejected = assert.rejects(slow.ask(schema, '', ''), /timed out/)
  const timer = [...slow.timers][0]
  assert.equal(timer.ms, 60_000)
  timer.fn()
  await rejected
  assert.equal(slow.wasKilled(), true)
  assert.equal(slow.timers.size, 0)
})
