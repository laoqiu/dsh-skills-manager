import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const require = createRequire(import.meta.url)
const emptyCatalog = { rows: [], warnings: [], projects: [] }

function fixture(t, handler = async () => ({ ok: true, value: emptyCatalog })) {
  let plugin, dictionaries, navigation
  const effects = [], entries = new Map(), events = new Map()
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: definition => {
      assert.equal(definition.id, 'dsh-skills-manager')
      plugin = definition.factory(name => name.startsWith('@deepseek-ai/') ? {} : require(name))
    } } },
    document: { createElement: () => ({ remove() {} }), head: { appendChild() {} } },
  })
  const translate = (key, args = {}) => {
    let text = dictionaries.en[key]
    for (const [name, value] of Object.entries(args)) text = text.replaceAll(`{${name}}`, String(value))
    return text
  }
  plugin.apply({
    effect: register => effects.push(register()),
    on: (event, listener) => events.set(event, listener),
    locale: { bind: () => translate, register: (_, values) => { dictionaries = values; return () => {} } },
    connection: { rpc: { call: async (_, method, payload) => ({ ok: true, value: await handler(method, payload) }) } },
    workspaces: { list: { getSnapshot: () => ({ phase: 'ready', items: [{ workspaceId: 'project', path: '/project', title: 'Project' }] }) } },
    uiWorkspace: { startSession: (...args) => { navigation = args } },
    slots: { inject: (_, register) => register(), register: (options, component) => {
      entries.set(options.name, { options, component }); return () => entries.delete(options.name)
    } },
  })
  const actions = entries.get('settings.section').options.inject()
  t.after(() => { effects.at(-1)() })
  return { actions, entries, events, get navigation() { return navigation }, get dictionaries() { return dictionaries } }
}

test('registers a settings page and global notices without permanent navigation entries', t => {
  const { entries, dictionaries } = fixture(t)
  assert.deepEqual([...entries.keys()], ['settings.section', 'shell.overlay'])
  assert.equal(entries.get('settings.section').options.id, 'skills-manager')
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), Object.keys(dictionaries.en).sort())
})

test('creation opens the filtered workspace with a draft and never submits a message', t => {
  const f = fixture(t)
  assert.equal(f.actions.create('project'), true)
  assert.equal(f.navigation[0], 'project')
  assert.equal(f.navigation[1].clearPreviousDraft, false)
  assert.match(f.navigation[1].prompt, /Target workspace: \/project/)
  assert.match(f.navigation[1].prompt, /do not overwrite existing skills/)
})

test('failed deletion keeps the catalog and reports through a notice outside settings', async t => {
  const row = { id: 'id', revision: 'revision', name: 'example', description: 'Example', path: '/skills/example/SKILL.md',
    scope: 'global', source: 'user-dsh', project: '', workspaceIds: [], enabled: true,
    modelInvocable: true, userInvocable: true, readOnly: false, invalid: false }
  const f = fixture(t, async method => method.endsWith('/delete') ? { ok: false, code: 'conflict' } : { ok: true, value: { ...emptyCatalog, rows: [row] } })
  await f.actions.load()
  assert.equal(await f.actions.remove(row), false)
  assert.equal(f.actions.hooks.skills.getSnapshot().catalog.rows[0].id, row.id)
  assert.equal(f.actions.hooks.skills.getSnapshot().notice.error, true)
  assert.match(f.actions.hooks.skills.getSnapshot().notice.text, /file changed/)
  assert.equal(f.actions.hooks.skills.getSnapshot().busy, false)
})

test('a superseded catalog cannot replace a newer result', async t => {
  const pending = []
  const f = fixture(t, () => new Promise(resolve => pending.push(resolve)))
  const old = f.actions.load(), latest = f.actions.load()
  pending[1]({ ok: true, value: { ...emptyCatalog, projects: [{ id: 'new', title: 'New', path: '/new' }] } })
  await latest
  pending[0]({ ok: true, value: emptyCatalog })
  await old
  assert.equal(f.actions.hooks.skills.getSnapshot().catalog.projects[0].id, 'new')
})

test('save failures reject to the editor so it can retain the unsaved text', async t => {
  const f = fixture(t, async () => ({ ok: false, code: 'invalid-skill' }))
  await assert.rejects(f.actions.save({ id: 'id', revision: 'r' }, 'draft'), { code: 'invalid-skill' })
  assert.equal(f.actions.hooks.skills.getSnapshot().busy, false)
})
