import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'
import { parse } from 'yaml'

test('the install patch imports the packaged host and exposes the documented configuration id', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const patch = parse(await readFile(new URL(`../${manifest.dsh.bundle.patch}`, import.meta.url), 'utf8'))
  const [entry] = patch[0].insert
  const plugin = await import(entry.name)
  assert.equal(entry.name, manifest.name)
  assert.equal(entry.id, 'dsh-skills-manager')
  assert.equal(typeof plugin.apply, 'function')
})

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'dsh-skills-host-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const home = join(base, 'dsh'), agents = join(base, 'agents'), project = join(base, 'project')
  await mkdir(join(home, 'skills', 'global'), { recursive: true })
  await mkdir(join(project, '.agents', 'skills', 'local'), { recursive: true })
  const skill = name => `---\nname: ${name}\ndescription: ${name} skill\n---\nBody\n`
  await writeFile(join(home, 'skills', 'global', 'SKILL.md'), skill('global'))
  await writeFile(join(project, '.agents', 'skills', 'local', 'SKILL.md'), skill('local'))
  const routes = new Map(), effects = [], warnings = []
  const projects = [{ id: 'workspace', path: project, title: 'Project' }]
  apply({
    workspaceRegistry: { list: () => projects },
    connection: { fetch: { register: route => { routes.set(route.path, route); return () => routes.delete(route.path) } } },
    effect: register => { effects.push(register()) }, logger: { warn: (...args) => warnings.push(args) },
  }, { dshHome: home, agentsHome: agents })
  const call = async (method, payload = {}, overrides = {}) => {
    const request = new Request(`http://localhost/api/skills-manager/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'test-request', method: `skills-manager/${method}`, payload, ...overrides }),
    })
    const response = await routes.get(`/api/skills-manager/${method}`).fetch(request)
    if (response.status !== 200) return { status: response.status }
    const envelope = await response.json()
    assert.equal(envelope.type, 'server-response')
    assert.equal(envelope.rpcId, 'test-request')
    return envelope.result.value
  }
  const close = () => effects.at(-1)()
  t.after(close)
  return { call, close, home, warnings, projects }
}

test('authenticated routes list actual global and registered project skills', async t => {
  const { call } = await fixture(t)
  const response = await call('list')
  assert.equal(response.ok, true)
  const rows = response.value.rows.filter(row => ['global', 'local'].includes(row.name))
  assert.deepEqual(rows.map(row => [row.name, row.scope]), [['global', 'global'], ['local', 'project']])
  assert.deepEqual(response.value.projects.map(row => row.id), ['workspace'])
})

test('workspaces in the same Git project share one physical skill and its revisions', async t => {
  const { call, projects } = await fixture(t)
  const root = projects[0].path, nested = join(root, 'nested')
  await mkdir(join(root, '.git'))
  await mkdir(nested)
  projects.push({ id: 'nested-workspace', path: nested, title: 'Nested' })
  const catalog = (await call('list')).value
  const shared = catalog.rows.filter(row => row.name === 'local')
  assert.equal(shared.length, 1)
  assert.deepEqual(shared[0].workspaceIds, ['workspace', 'nested-workspace'])
  await call('toggle', { id: shared[0].id, revision: shared[0].revision, enabled: false })
  const updated = (await call('list')).value.rows.find(row => row.id === shared[0].id)
  assert.equal(updated.enabled, false)
  assert.deepEqual(updated.workspaceIds, ['workspace', 'nested-workspace'])
})

test('routes reject malformed envelopes, arbitrary filesystem paths and extra parameters', async t => {
  const { call } = await fixture(t)
  assert.equal((await call('list', {}, { type: 'other' })).status, 400)
  assert.equal((await call('list', {}, { method: 'skills-manager/delete' })).status, 400)
  assert.equal((await call('delete', { id: 'x', revision: 'x', path: '../../outside' })).status, 400)
  assert.deepEqual(await call('read', { id: '../../outside' }), { ok: false, code: 'not-found' })
})

test('concurrent mutations serialize; a stale second request cannot overwrite the first', async t => {
  const { call, home } = await fixture(t)
  const row = (await call('list')).value.rows.find(row => row.name === 'global')
  const input = { id: row.id, revision: row.revision, enabled: false }
  const results = await Promise.all([call('toggle', input), call('toggle', input)])
  assert.equal(results.filter(result => result.ok).length, 1)
  assert.deepEqual(results.find(result => !result.ok), { ok: false, code: 'conflict' })
  assert.match(await readFile(join(home, 'skills', 'global', 'SKILL.md'), 'utf8'), /user-invocable: false/)
})

test('unload refuses further requests and does not poison subsequent failure reporting', async t => {
  const { call, close } = await fixture(t)
  await close()
  assert.deepEqual(await call('list'), { ok: false, code: 'unloading' })
  assert.deepEqual(await call('list'), { ok: false, code: 'unloading' })
})
