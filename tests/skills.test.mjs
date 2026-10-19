import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, access, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as yaml } from 'yaml'
import { SkillFiles, projectRoot, toggleText } from '../lib/skills.js'

const skill = (name = 'example', fields = '') => `---\nname: ${name}\ndescription: Example description\n${fields}---\n# Instructions\nKeep this body.\n`
const metadata = text => yaml(/^---\n([\s\S]*?)\n---/.exec(text)[1])
async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'dsh-skills-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const root = join(base, 'skills')
  await mkdir(root)
  const declared = { path: root, scope: 'global', source: 'user-dsh', project: '', workspaceIds: [], readOnly: false, skipSystem: true }
  const files = new SkillFiles(async () => [declared], 8192)
  const create = async (name, text = skill(name), flat = false) => {
    const path = flat ? join(root, `${name}.md`) : join(root, name, 'SKILL.md')
    if (!flat) await mkdir(join(root, name), { recursive: true })
    await writeFile(path, text)
    return path
  }
  return { base, root, declared, files, create }
}

test('lists disabled, duplicate-name and invalid physical entries without merging them', async t => {
  const { create, files, root } = await fixture(t)
  await create('folder', skill('same'))
  await create('flat', skill('same', 'disable-model-invocation: true\nuser-invocable: false\n'), true)
  await create('broken', '# Missing metadata')
  await mkdir(join(root, '.system')); await writeFile(join(root, '.system', 'SKILL.md'), skill('internal'))
  const { rows, warnings } = await files.list()
  assert.equal(rows.length, 3)
  assert.equal(rows.filter(row => row.name === 'same').length, 2)
  assert.equal(rows.filter(row => row.enabled).length, 1)
  assert.equal(rows.find(row => row.name === 'broken').invalid, true)
  assert.deepEqual(warnings, [])
})

test('disable hides both invocation paths; enable restores a manual-only policy and nested metadata', () => {
  const original = skill('example', '# Keep this comment\ndisable-model-invocation: true\nmetadata:\n  nested: [one, two]\n')
  const disabled = toggleText(original, false)
  assert.equal(metadata(disabled)['disable-model-invocation'], true)
  assert.equal(metadata(disabled)['user-invocable'], false)
  const enabled = toggleText(disabled, true)
  assert.equal(metadata(enabled)['disable-model-invocation'], true)
  assert.equal('user-invocable' in metadata(enabled), false)
  assert.deepEqual(metadata(enabled).metadata, { nested: ['one', 'two'] })
  assert.ok(enabled.includes('# Keep this comment'))
  assert.ok(enabled.endsWith('# Instructions\nKeep this body.\n'))
  assert.equal('x-dsh-skills-manager-invocation' in metadata(enabled), false)
})

test('previously disabled external skills can be enabled and scalar invocation forms match DSH', () => {
  const enabled = toggleText(skill('example', 'disable-model-invocation: "on"\nuser-invocable: "off"\n'), true)
  assert.equal('disable-model-invocation' in metadata(enabled), false)
  assert.equal('user-invocable' in metadata(enabled), false)
  assert.throws(() => toggleText(skill('example', 'user-invocable: perhaps\n'), false), { code: 'invalid-skill' })
})

test('toggle writes real files and restores the original invocation policy', async t => {
  const { create, files } = await fixture(t)
  const path = await create('manual', skill('manual', 'disable-model-invocation: true\n'))
  const row = (await files.list()).rows[0]
  await files.toggle({ ...row, enabled: false })
  assert.equal((await files.list()).rows[0].enabled, false)
  await files.toggle({ ...(await files.list()).rows[0], enabled: true })
  assert.equal(metadata(await readFile(path, 'utf8'))['disable-model-invocation'], true)
  assert.equal((await files.list()).rows[0].userInvocable, true)
})

test('save validates complete YAML, retains resources and refuses stale revisions', async t => {
  const { create, files } = await fixture(t)
  const path = await create('example')
  await writeFile(join(path, '..', 'resource.txt'), 'resource')
  const row = (await files.list()).rows[0]
  await assert.rejects(files.save({ ...row, text: skill('Invalid Name') }), { code: 'invalid-skill' })
  assert.equal(await readFile(path, 'utf8'), skill())
  await files.save({ ...row, text: skill('renamed') })
  assert.equal((await files.list()).rows[0].name, 'renamed')
  assert.equal(await readFile(join(path, '..', 'resource.txt'), 'utf8'), 'resource')
  await assert.rejects(files.save({ ...row, text: skill('stale') }), { code: 'conflict' })
  await assert.rejects(files.delete(row), { code: 'conflict' })
  assert.equal(metadata(await readFile(path, 'utf8')).name, 'renamed')
})

test('invalid instruction files remain editable and can be repaired', async t => {
  const { create, files } = await fixture(t)
  await create('broken', 'Not a valid skill')
  const row = (await files.list()).rows[0]
  assert.equal((await files.read(row.id)).text, 'Not a valid skill')
  await files.save({ ...row, text: skill('repaired') })
  assert.equal((await files.list()).rows[0].invalid, false)
})

test('delete removes only the selected flat file or directory and its resources', async t => {
  const { create, files, root } = await fixture(t)
  await create('one'); await create('two', skill('two'), true)
  await mkdir(join(root, 'one', 'assets')); await writeFile(join(root, 'one', 'assets', 'a.txt'), 'a')
  let rows = (await files.list()).rows
  await files.delete(rows.find(row => row.name === 'one'))
  await assert.rejects(access(join(root, 'one')))
  assert.equal((await files.list()).rows.length, 1)
  rows = (await files.list()).rows
  await files.delete(rows[0])
  assert.deepEqual((await files.list()).rows, [])
})

test('bundled roots and linked skills are read-only; unknown IDs cannot select arbitrary files', async t => {
  const { create, files, declared, base, root } = await fixture(t)
  const path = await create('example')
  declared.readOnly = true
  const row = (await files.list()).rows[0]
  await assert.rejects(files.save({ ...row, text: skill('changed') }), { code: 'read-only' })
  await assert.rejects(files.toggle({ ...row, enabled: false }), { code: 'read-only' })
  await assert.rejects(files.delete(row), { code: 'read-only' })
  await assert.rejects(files.read(join(base, '..', 'outside.md')), { code: 'not-found' })
  declared.readOnly = false
  await symlink(join(path, '..'), join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  const linked = (await files.list()).rows.find(item => item.path.includes(`${process.platform === 'win32' ? '\\' : '/'}linked`))
  assert.equal(linked.readOnly, true)
  await assert.rejects(files.delete(linked), { code: 'read-only' })
})

test('deleting a directory unlinks nested junctions without deleting their targets', async t => {
  const { create, files, base, root } = await fixture(t)
  await create('example')
  const outside = join(base, 'outside'); await mkdir(outside); await writeFile(join(outside, 'keep.txt'), 'keep')
  await symlink(outside, join(root, 'example', 'linked-assets'), process.platform === 'win32' ? 'junction' : 'dir')
  await files.delete((await files.list()).rows[0])
  assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'keep')
})

test('oversized and unreadable entries produce an explicit incomplete catalog warning', async t => {
  const { create, files } = await fixture(t)
  await create('large', skill('large') + 'x'.repeat(9000))
  const catalog = await files.list()
  assert.equal(catalog.rows.length, 0)
  assert.equal(catalog.warnings.length, 1)
})

test('project root discovery matches the nearest Git ancestor or the original workspace', async t => {
  const { base } = await fixture(t)
  const nested = join(base, 'repo', 'nested'); await mkdir(nested, { recursive: true })
  await writeFile(join(base, 'repo', '.git'), 'gitdir: elsewhere')
  assert.equal(await realpath(await projectRoot(nested)), await realpath(join(base, 'repo')))
  const plain = join(base, 'plain'); await mkdir(plain)
  assert.equal(await projectRoot(plain), plain)
})
