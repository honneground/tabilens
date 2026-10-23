import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Compile only the pure helpers so the checks need no browser or API credits.
function loadModule(name) {
  const source = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, URLSearchParams, require: (path) => loadModule(path.replace('./', '')) })
  return exports
}
const { placeItem, itemDay, mapLinks } = loadModule('trip')
const { completedSearches, cachedSearch } = loadModule('searchHistory')
const card = (id, dayId = 'day-1') => ({ id, dayId, note: 'Keep my note', kind: 'spot', title: id, spot: { lat: 35 + Number(id) / 100, lon: 139 } })
const ids = (items) => Array.from(items, (i) => i.id)
const run = (id, query = id) => ({ id, query, done: true, articles: [], spots: [], locked: [] })

test('old trip cards default to Day 1', () => {
  assert.equal(itemDay({ id: 'legacy' }), 'day-1')
})
test('reorder within a day without duplicates or lost notes', () => {
  const items = [card('1'), card('2'), card('3')]
  const next = placeItem(items, { ...items[2], note: '' }, 'day-1', '1')
  assert.deepEqual(ids(next), ['3', '1', '2'])
  assert.equal(next[0].note, 'Keep my note')
  assert.deepEqual(ids(items), ['1', '2', '3'])
  assert.equal(placeItem(next, next[0], 'day-1', '3'), next)
})
test('move to an empty day, insert before another day card, and append', () => {
  let items = [card('1'), card('2'), card('3', 'day-2')]
  items = placeItem(items, items[0], 'day-3')
  assert.equal(items.find((i) => i.id === '1').dayId, 'day-3')
  items = placeItem(items, items.find((i) => i.id === '2'), 'day-2', '3')
  assert.deepEqual(ids(items.filter((i) => itemDay(i) === 'day-2')), ['2', '3'])
  items = placeItem(items, items.find((i) => i.id === '2'), 'day-2')
  assert.deepEqual(ids(items.filter((i) => itemDay(i) === 'day-2')), ['3', '2'])
  assert.equal(items.length, 3)
})
test('new cards are inserted in the target day', () => {
  const items = placeItem([card('1')], card('2'), 'day-2')
  assert.equal(items[1].dayId, 'day-2')
})
test('Maps excludes articles and invalid locations and supports one place', () => {
  assert.equal(mapLinks([{ id: 'article' }], 'walking').length, 0)
  assert.equal(mapLinks([{ spot: { lat: NaN, lon: 139 } }], 'walking').length, 0)
  assert.equal(mapLinks([{ spot: { lat: 91, lon: 139 } }], 'walking').length, 0)
  const url = new URL(mapLinks([card('1')], 'walking')[0])
  assert.equal(url.pathname, '/maps/search/')
  assert.equal(url.searchParams.get('query'), '35.01,139')
})
test('long Maps routes preserve stop order with overlapping segments', () => {
  const links = mapLinks(Array.from({ length: 7 }, (_, i) => card(String(i))), 'walking').map((u) => new URL(u))
  assert.equal(links.length, 2)
  assert.equal(links[0].searchParams.get('waypoints').split('|').length, 3)
  assert.equal(links[0].searchParams.get('destination'), links[1].searchParams.get('origin'))
  assert.equal(links[1].searchParams.get('destination'), '35.06,139')
})
test('transit exports every consecutive leg without unsupported waypoints', () => {
  const links = mapLinks([card('1'), card('2'), card('3')], 'transit').map((u) => new URL(u))
  assert.equal(links.length, 2)
  assert.ok(links.every((u) => !u.searchParams.has('waypoints') && u.searchParams.get('travelmode') === 'transit'))
  assert.equal(links[0].searchParams.get('destination'), links[1].searchParams.get('origin'))
})
test('history saves only complete successful results and deduplicates queries', () => {
  const result = completedSearches([run('new', 'Nikko'), { ...run('pending'), done: false }, { ...run('failed'), error: 'Network error' }, run('old', ' Nikko ')])
  assert.deepEqual(Array.from(result, (r) => r.id), ['new'])
  assert.equal(cachedSearch(result, ' Nikko ').id, 'new')
  assert.equal(cachedSearch(result, 'Tokyo'), undefined)
  assert.equal(completedSearches(null).length, 0)
})
test('history keeps twelve results and round-trips their contents', () => {
  const input = Array.from({ length: 15 }, (_, i) => run(String(i)))
  input[0].articles.push({ id: 'article', text: 'Example excerpt' })
  const restored = JSON.parse(JSON.stringify(completedSearches(input)))
  assert.equal(restored.length, 12)
  assert.equal(cachedSearch(restored, '0').articles[0].text, 'Example excerpt')
})
