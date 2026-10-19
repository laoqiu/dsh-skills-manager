/** Filesystem skills management; no DSH state or Client dependencies. */
import { createHash, randomUUID } from 'node:crypto'
import { access, lstat, readFile, readdir, realpath, rename, rmdir, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { isMap, parseDocument } from 'yaml'
import type { Catalog, ErrorCode, SkillRow } from './protocol.js'

/** A declared skills directory; project directories come from the Workspace registry. */
export interface Root {
  path: string
  scope: 'global' | 'project'
  source: string
  project: string
  workspaceIds: string[]
  readOnly: boolean
  skipSystem?: boolean
}

/** A refused operation has no mutation, except delete-incomplete which can remove resource files. */
export class SkillError extends Error {
  constructor(readonly code: ErrorCode, options?: ErrorOptions) { super(code, options) }
}

/** Locate the nearest Git root, matching DSH filesystem skill discovery.
 * @param cwd Workspace directory.
 * @returns Git root, or the workspace itself when none exists.
 */
export async function projectRoot(cwd: string): Promise<string> {
  let current = resolve(cwd)
  for (;;) {
    try { await access(join(current, '.git')); return current }
    catch (error) { if (!isMissing(error)) throw error }
    const parent = dirname(current)
    if (parent === current) return resolve(cwd)
    current = parent
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function digest(text: string): string { return createHash('sha256').update(text).digest('hex') }
const BACKUP = 'x-dsh-skills-manager-invocation'

function boolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  if (typeof value === 'string') {
    if (['true', 'yes', 'on'].includes(value.toLowerCase())) return true
    if (['false', 'no', 'off'].includes(value.toLowerCase())) return false
  }
  throw new SkillError('invalid-skill')
}

/** Parse frontmatter with YAML's document API so unrelated metadata and comments survive edits. */
function parse(text: string) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!match) throw new SkillError('invalid-skill')
  const document = parseDocument(match[1]!, { uniqueKeys: true })
  if (document.errors.length || !isMap(document.contents)) throw new SkillError('invalid-skill')
  let data: Record<string, unknown>
  try { data = document.toJS({ maxAliasCount: 50 }) as Record<string, unknown> }
  catch (cause) { throw new SkillError('invalid-skill', { cause }) }
  if (typeof data.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name) || data.name.length > 64
    || typeof data.description !== 'string' || !data.description.trim()
    || ['disableModelInvocation', 'modelInvocable', 'userInvocable'].some(key => key in data)) throw new SkillError('invalid-skill')
  const modelInvocable = !boolean(data['disable-model-invocation'], false)
  const userInvocable = boolean(data['user-invocable'], true)
  return { document, data, name: data.name, description: data.description, modelInvocable, userInvocable, body: text.slice(match[0].length) }
}

/** Rewrite only invocation controls and their restore marker.
 * @param text Current complete SKILL.md.
 * @param enabled False disables both entry points; true restores the prior policy, or enables both if none was saved.
 * @returns Valid complete skill text retaining other YAML fields and body.
 */
export function toggleText(text: string, enabled: boolean): string {
  const parsed = parse(text)
  const { document, data } = parsed
  if (enabled) {
    const saved = data[BACKUP]
    if (saved !== undefined && (typeof saved !== 'object' || saved === null || Array.isArray(saved))) throw new SkillError('invalid-skill')
    const previous = saved as Record<string, unknown> | undefined
    for (const key of ['disable-model-invocation', 'user-invocable']) {
      if (previous && key in previous) { boolean(previous[key], true); document.set(key, previous[key]) }
      else document.delete(key)
    }
    document.delete(BACKUP)
  } else {
    if (!parsed.modelInvocable && !parsed.userInvocable) return text
    if (BACKUP in data) throw new SkillError('invalid-skill')
    const previous: Record<string, unknown> = {}
    for (const key of ['disable-model-invocation', 'user-invocable']) if (key in data) previous[key] = data[key]
    document.set(BACKUP, previous)
    document.set('disable-model-invocation', true)
    document.set('user-invocable', false)
  }
  const next = `---\n${document.toString()}---\n${parsed.body}`
  parse(next)
  return next
}

interface Entry { row: SkillRow; root: string; target: string; text: string }

/** Repository for explicitly supplied filesystem roots; mutations re-discover IDs and check revisions. */
export class SkillFiles {
  constructor(private readonly roots: () => Promise<Root[]>, private readonly maxFileBytes: number) {}

  private async discover(): Promise<{ entries: Entry[]; warnings: string[] }> {
    const entries: Entry[] = [], warnings: string[] = []
    const visited = new Set<string>()
    for (const declared of await this.roots()) {
      let root: string
      try { root = await realpath(declared.path) }
      catch (error) { if (isMissing(error)) continue; warnings.push(declared.path); continue }
      if (visited.has(root)) continue
      visited.add(root)
      let children
      try { children = await readdir(root, { withFileTypes: true }) }
      catch (error) { warnings.push(declared.path); continue }
      for (const child of children) {
        if (declared.skipSystem && child.name === '.system') continue
        const target = join(root, child.name)
        try {
          const linked = child.isSymbolicLink()
          let path = join(target, 'SKILL.md')
          if (child.isFile() || (linked && child.name.endsWith('.md'))) path = target
          else if (!child.isDirectory() && !linked) continue
          if (path === target && !child.name.endsWith('.md')) continue
          const info = await lstat(path)
          const readOnly = declared.readOnly || linked || info.isSymbolicLink()
          const text = await this.readText(path)
          let summary
          try { summary = parse(text) } catch (error) { if (!(error instanceof SkillError)) throw error }
          const row: SkillRow = {
            id: digest(path), name: summary?.name ?? basename(target, '.md'), description: summary?.description ?? '',
            path, scope: declared.scope, source: declared.source, project: declared.project, workspaceIds: declared.workspaceIds,
            enabled: summary ? summary.modelInvocable || summary.userInvocable : false,
            modelInvocable: summary?.modelInvocable ?? false, userInvocable: summary?.userInvocable ?? false,
            invalid: !summary, readOnly, revision: digest(text),
          }
          entries.push({ row, root, target, text })
        } catch (error) { if (!isMissing(error)) warnings.push(target) }
      }
    }
    entries.sort((a, b) => a.row.name.localeCompare(b.row.name) || a.row.path.localeCompare(b.row.path))
    return { entries, warnings }
  }

  /** List physical entries, including disabled, invalid and shadowed copies.
   * @returns Rows and directories that could not be read; bundled and linked entries are read-only.
   */
  async list(): Promise<Pick<Catalog, 'rows' | 'warnings'>> {
    const { entries, warnings } = await this.discover()
    return { rows: entries.map(entry => entry.row), warnings }
  }

  private async readText(path: string): Promise<string> {
    const file = await stat(path)
    if (!file.isFile()) throw new SkillError('read-only')
    if (file.size > this.maxFileBytes) throw new SkillError('file-too-large')
    const text = await readFile(path, 'utf8')
    if (Buffer.byteLength(text) > this.maxFileBytes) throw new SkillError('file-too-large')
    return text
  }

  private async entry(id: string, revision?: string): Promise<Entry> {
    const entry = (await this.discover()).entries.find(item => item.row.id === id)
    if (!entry) throw new SkillError('not-found')
    if (revision !== undefined) {
      if (entry.row.readOnly) throw new SkillError('read-only')
      if (entry.row.revision !== revision) throw new SkillError('conflict')
      const child = relative(entry.root, entry.target)
      if (!child || isAbsolute(child) || child.split(sep).length !== 1 || child === '..'
        || (await lstat(entry.target)).isSymbolicLink() || (await lstat(entry.row.path)).isSymbolicLink()
        || await realpath(entry.root) !== entry.root) throw new SkillError('read-only')
    }
    return entry
  }

  /** Read an authorized catalog entry.
   * @param id Server-issued entry ID.
   * @returns Current row, revision and full instruction file.
   */
  async read(id: string): Promise<{ row: SkillRow; text: string }> {
    const { row, text } = await this.entry(id)
    return { row, text }
  }

  private async write(entry: Entry, text: string): Promise<void> {
    if (Buffer.byteLength(text) > this.maxFileBytes) throw new SkillError('file-too-large')
    const temporary = join(dirname(entry.row.path), `.skills-manager-${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, text, { flag: 'wx', mode: (await lstat(entry.row.path)).mode & 0o777 })
      await this.entry(entry.row.id, entry.row.revision)
      await rename(temporary, entry.row.path)
    } finally {
      try { await unlink(temporary) } catch (error) { if (!isMissing(error)) throw error }
    }
  }

  /** Save a validated instruction file without renaming its resource directory.
   * @param input Entry ID, expected revision and full Markdown text.
   * @returns Completion after replacement; stale revisions leave the original file intact.
   */
  async save(input: { id: string; revision: string; text: string }): Promise<void> {
    parse(input.text)
    await this.write(await this.entry(input.id, input.revision), input.text)
  }

  /** Persist the invocation policy change.
   * @param input Entry identity, expected revision and desired enabled state.
   * @returns Completion after atomic file replacement.
   */
  async toggle(input: { id: string; revision: string; enabled: boolean }): Promise<void> {
    const entry = await this.entry(input.id, input.revision)
    await this.write(entry, toggleText(entry.text, input.enabled))
  }

  /** Delete one flat file or the skill directory with its resources; nested links are only unlinked.
   * @param input Entry identity and expected revision.
   * @returns Completion after removal; delete-incomplete may leave partially removed resources and keeps SKILL.md when possible.
   */
  async delete(input: { id: string; revision: string }): Promise<void> {
    const entry = await this.entry(input.id, input.revision)
    try {
      if (entry.target !== entry.row.path) {
        for (const name of await readdir(entry.target)) if (name !== 'SKILL.md') await removeTree(join(entry.target, name), entry.target)
      }
      await this.entry(input.id, input.revision)
      await unlink(entry.row.path)
      if (entry.target !== entry.row.path) await rmdir(entry.target)
    } catch (cause) { throw new SkillError('delete-incomplete', { cause }) }
  }
}

async function removeTree(path: string, root: string): Promise<void> {
  const local = relative(root, path)
  if (!local || isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`)) throw new SkillError('read-only')
  const info = await lstat(path)
  if (info.isSymbolicLink() || !info.isDirectory()) { await unlink(path); return }
  for (const name of await readdir(path)) await removeTree(join(path, name), root)
  await rmdir(path)
}
