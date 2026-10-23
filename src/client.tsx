/** Native Skills settings page and app-wide operation feedback. */
import { useEffect, useId, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button, Input, Menu, Modal, Switch, Tag, Toast, Tooltip,
  IconChevronDownOutlineRegular, IconEditOutlineRegular, IconTrashOutlineRegular,
  IconPlusOutlineRegular, IconSearchOutlineRegular, IconSkillOutlineRegular, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { z } from 'zod'
import { Catalog, Failure, NS, PREFIX, responses, type ErrorCode, type Method, type SkillRow } from './protocol.js'
import { en, zh, type Key } from './locales.js'
import css from './styles.js'

declare const PLUGIN_VERSION: string

function HeaderIcon({ name }: { name: 'refresh' | 'github' | 'edit' }) {
  const paths = name === 'refresh'
    ? ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5']
    : name === 'github'
    ? ['M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4', 'M9 18c-4.51 2-5-2-7-2']
    : ['M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M16 3a2.12 2.12 0 0 1 3 3l-9 9-4 1 1-4Z']
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths.map(d => <path key={d} d={d} />)}</svg>
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'skills-manager': Key }
}
declare module '@deepseek-ai/cordis' {
  interface Context { connection: ConnectionHandle }
}

interface State {
  catalog: Catalog | null
  loading: boolean
  busy: boolean
  error: boolean
  notice: { id: number; text: string; error: boolean } | null
}
interface Actions {
  hooks: { skills: Pick<SnapshotStore<State>, 'getSnapshot' | 'subscribe'> }
  load: () => Promise<void>
  read: (id: string) => Promise<z.infer<typeof responses.read>>
  save: (row: SkillRow, text: string) => Promise<boolean>
  remove: (row: SkillRow) => Promise<boolean>
  toggle: (row: SkillRow) => Promise<boolean>
  create: (projectId?: WorkspaceId) => boolean
  failure: (error: unknown) => string
  dismiss: (id: number) => void
}
type PageProps = PropsRuntime<'settings.section'> & PropsLocale<'skills-manager'> & InjectFace<Actions>

/** Check the private registry's public version index. */
function UpdateButton({ t }: Pick<PageProps, 't'>) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<{ phase: 'checking' | 'ready' | 'unpublished' | 'error'; version?: string }>({ phase: 'checking' })
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  const close = () => { request.current?.abort(); setOpen(false) }
  const check = async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setOpen(true)
    setCopied(false)
    setResult({ phase: 'checking' })
    try {
      const response = await fetch('https://registry.antistudio.cn/index.json', {
        credentials: 'omit', headers: { accept: 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      })
      if (controller.signal.aborted) return
      if (response.status === 404) { setResult({ phase: 'unpublished' }); return }
      if (!response.ok) throw new Error('Release request failed')
      const index = z.object({ format: z.literal(1), plugins: z.array(z.object({ name: z.string(), versions: z.array(z.object({ version: z.string(), source: z.object({ type: z.string(), registry: z.string().optional() }) })) })) }).parse(await response.json())
      const release = index.plugins.find(plugin => plugin.name === 'dsh-skills-manager')?.versions
        .filter(item => /^\d+\.\d+\.\d+$/.test(item.version) && item.source.type === 'npm' && item.source.registry === 'https://registry.antistudio.cn/')
        .sort((left, right) => right.version.localeCompare(left.version, 'en', { numeric: true }))[0]
      if (!release) { setResult({ phase: 'unpublished' }); return }
      if (!controller.signal.aborted) setResult({ phase: 'ready', version: release.version })
    } catch (error) {
      if (!controller.signal.aborted) setResult({ phase: 'error' })
    }
  }
  const updateAddress = result.version ? `https://registry.antistudio.cn/dsh-skills-manager/-/dsh-skills-manager-${result.version}.tgz` : ''
  const status = result.phase === 'ready'
    ? result.version!.localeCompare(PLUGIN_VERSION, 'en', { numeric: true }) > 0 ? 'updateAvailable' : 'upToDate'
    : result.phase === 'checking' ? 'checkingUpdates' : result.phase === 'unpublished' ? 'noRelease' : 'updateCheckFailed'
  return <>
    <Tooltip label={t('checkUpdates')} side="bottom" portal><Button size="sm" variant="ghost" className="skm-header-action" aria-label={t('checkUpdates')}
      icon={<HeaderIcon name="refresh" />} onClick={() => { void check() }} /></Tooltip>
    <Modal open={open} title={t('checkUpdates')} closeLabel={t('close')} onClose={close}
      footer={<div className="skm-actions"><Button variant="outline" disabled={result.phase === 'checking'} onClick={() => { void check() }}>{t('checkAgain')}</Button>
        <Button variant="primary" disabled={result.phase !== 'ready'} onClick={() => { if (updateAddress) void navigator.clipboard?.writeText(updateAddress).then(() => setCopied(true)).catch(() => setCopied(false)) }}>{t(copied ? 'copiedUpdateUrl' : 'viewRelease')}</Button></div>}>
      <div className="skm-update"><p>{t('currentVersion')} · v{PLUGIN_VERSION}</p>
        {result.version && <p>{t('latestVersion')} · v{result.version}</p>}
        {updateAddress && <><p>{t('updateHint')}</p><code style={{ display: 'block', overflowWrap: 'anywhere', fontSize: 12 }}>{updateAddress}</code></>}
        <p role={result.phase === 'error' ? 'alert' : 'status'}>{result.phase === 'checking' && <StateDot state="ongoing" />} {t(status)}</p>
      </div>
    </Modal>
  </>
}

class RequestError extends Error {
  constructor(readonly code: ErrorCode) { super(code) }
}

/** Settings list; transient mutations retain rows on failure, and dialogs retain unsaved edits. */
function SkillsPage(props: PageProps) {
  const { t } = props
  const state = props.useSkills(value => value)
  const [query, setQuery] = useState(''), [workspaceFilter, setWorkspaceFilter] = useState('*')
  const [filterOpen, setFilterOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const groupId = useId()
  const workspaces = props.useWorkspaces(value => value.items)
  const selectedWorkspace = workspaces.find(row => row.workspaceId === workspaceFilter)
  const selectedId = selectedWorkspace?.workspaceId ?? '*'
  const [confirmation, setConfirmation] = useState<SkillRow | null>(null)
  const [editor, setEditor] = useState<{ row: SkillRow; text: string; error: string | null } | null>(null)
  const [reading, setReading] = useState(false)
  const alive = useRef(false)
  const readGeneration = useRef(0)
  useEffect(() => {
    alive.current = true
    void props.load()
    const refresh = () => { void props.load() }
    window.addEventListener('focus', refresh)
    return () => { alive.current = false; readGeneration.current++; window.removeEventListener('focus', refresh) }
  }, [props.load])
  const catalog = state.catalog
  const needle = query.trim().toLocaleLowerCase()
  const matches = (row: SkillRow) => !needle || `${row.name}\n${row.description}`.toLocaleLowerCase().includes(needle)
  const groups = [
    ...workspaces.filter(row => selectedId === '*' || row.workspaceId === selectedId).map(workspace => ({
      id: `workspace:${workspace.workspaceId}`, title: workspace.title, path: workspace.path,
      rows: (catalog?.rows ?? []).filter(row => row.scope === 'project' && row.workspaceIds.includes(workspace.workspaceId) && matches(row)),
    })),
    { id: 'global', title: t('global'), path: null, rows: (catalog?.rows ?? []).filter(row => row.scope === 'global' && matches(row)) },
  ].filter(group => !needle || group.rows.length > 0)
  const openEditor = async (row: SkillRow) => {
    const generation = ++readGeneration.current
    setReading(true)
    try {
      const result = await props.read(row.id)
      if (alive.current && generation === readGeneration.current) setEditor({ ...result, error: null })
    } catch (error) { /* read() owns the app-wide error notice. */ }
    finally { if (alive.current && generation === readGeneration.current) setReading(false) }
  }
  const save = async () => {
    if (!editor) return
    const current = editor
    try {
      if (await props.save(current.row, current.text) && alive.current) setEditor(null)
    } catch (error) {
      if (alive.current) setEditor(value => value ? { ...value, error: props.failure(error) } : value)
    }
  }
  const unavailable = state.busy || reading
  return <section className="skm-page" aria-busy={state.loading || unavailable}>
    <header className="skm-header">
      <div className="skm-title-row"><h2>{t('nav')}<span className="skm-version">v{PLUGIN_VERSION}</span></h2>
        <div className="skm-header-actions">
          <UpdateButton t={t} />
          {(['github', 'edit'] as const).map(action => <Tooltip key={action} label={t(action === 'github' ? 'viewProject' : 'feedback')} side="bottom" portal>
            <Button size="sm" variant="ghost" className="skm-header-action" aria-label={t(action === 'github' ? 'viewProject' : 'feedback')} icon={<HeaderIcon name={action} />}
              onClick={() => { window.open(`https://github.com/laoqiu/dsh-skills-manager${action === 'edit' ? '/issues' : ''}`, '_blank', 'noreferrer') }} />
          </Tooltip>)}
        </div>
      </div>
      <p className="skm-subtitle">{t('subtitle')}</p>
    </header>
    <div className="skm-toolbar">
      <Input className="skm-search" icon={<IconSearchOutlineRegular size={16} />} value={query}
        onChange={event => { setQuery(event.target.value) }} placeholder={t('search')} aria-label={t('search')} />
      <Menu className="skm-filter" open={filterOpen} portal autoFocus align="end" selectedId={selectedId}
        onClose={() => { setFilterOpen(false) }}
        onSelect={id => { setWorkspaceFilter(id); setFilterOpen(false) }}
        items={[{ id: '*', label: t('allWorkspaces') }, ...workspaces.map(row => ({ id: row.workspaceId, label: row.title }))]}
        anchor={<Button size="md" variant="outline" aria-label={t('workspaceFilter')} aria-haspopup="menu" aria-expanded={filterOpen}
          onClick={() => { setFilterOpen(value => !value) }}><span className="skm-filter-label">{selectedWorkspace?.title ?? t('allWorkspaces')}</span>
          <IconChevronDownOutlineRegular size={14} /></Button>} />
    </div>
    {state.error && <p className="skm-notice skm-error" role="alert">{t('loadError')} <Button size="sm" variant="ghost" disabled={state.loading} onClick={() => { void props.load() }}>{t('retry')}</Button></p>}
    {!!catalog?.warnings.length && <p className="skm-notice" role="status">{t('warning')}</p>}
    {!catalog && state.loading ? <div className="skm-empty" role="status" aria-label={t('loading')}><StateDot state="ongoing" /></div>
      : !groups.length ? <div className="skm-empty"><IconSkillOutlineRegular size={24} /><span>{t('noResults')}</span>
          <Button size="sm" variant="ghost" onClick={() => { setQuery('') }}>{t('reset')}</Button></div>
      : groups.map(group => {
        const sectionId = `${groupId}-${encodeURIComponent(group.id)}`
        return <section className="skm-group" key={group.id} data-scope={group.id === 'global' ? 'global' : 'workspace'} aria-label={group.title}>
          <header className="skm-group-header"><h3><button type="button" className="skm-group-toggle"
            aria-expanded={!collapsed[group.id]} aria-controls={sectionId}
            onClick={() => { setCollapsed(value => ({ ...value, [group.id]: !value[group.id] })) }}>
            <IconChevronDownOutlineRegular size={12} /><span>{group.title}</span></button></h3>
            <span className="skm-count">{t('count', { count: group.rows.length })}</span>
          </header>
          {group.path !== null && <p className="skm-project-path">{group.path}</p>}
          <div id={sectionId} hidden={collapsed[group.id]}>
          {!group.rows.length ? <div className="skm-empty"><IconSkillOutlineRegular size={24} /><span>{t('empty')}</span></div>
            : <ul className="skm-card">{group.rows.map(row => <li className="skm-row" key={row.id}>
            <div className="skm-copy">
              <div className="skm-name"><Tooltip label={row.path} portal><span>{row.name}</span></Tooltip>
                {row.invalid ? <Tag tone="warning">{t('invalid')}</Tag>
                  : !row.enabled ? <Tag tone="neutral">{t('disabled')}</Tag>
                    : !row.modelInvocable ? <Tag tone="quiet">{t('userOnly')}</Tag>
                      : !row.userInvocable ? <Tag tone="quiet">{t('modelOnly')}</Tag> : null}
                {row.readOnly && <Tag>{t('readOnly')}</Tag>}
              </div>
              <p className="skm-description">{row.description || t('noDescription')}</p>
            </div>
            <div className="skm-row-actions">
              <Tooltip label={t('delete')} side="top" portal><Button size="sm" variant="ghost" className="skm-delete"
                icon={<IconTrashOutlineRegular size={16} />} aria-label={t('deleteSkill', { name: row.name })}
                disabled={unavailable || row.readOnly} onClick={() => { setConfirmation(row) }} /></Tooltip>
              <Tooltip label={t('edit')} side="top" portal><Button size="sm" variant="ghost"
                icon={<IconEditOutlineRegular size={16} />} aria-label={t('editSkill', { name: row.name })}
                disabled={unavailable || row.readOnly} onClick={() => { void openEditor(row) }} /></Tooltip>
              <Tooltip label={t(row.enabled ? 'disable' : 'enable')} portal><Switch checked={row.enabled}
                label={t('toggleSkill', { name: row.name })} disabled={unavailable || row.readOnly || row.invalid}
                onChange={() => { void props.toggle(row) }} /></Tooltip>
            </div>
          </li>)}</ul>}
          </div>
        </section>
      })}
    <section className="skm-custom"><h3>{t('custom')}</h3>
      <button type="button" className="skm-create" disabled={unavailable}
        onClick={() => { if (props.create(selectedWorkspace?.workspaceId)) props.close() }}><IconPlusOutlineRegular size={14} />{t('create')}</button>
    </section>
    <Modal open={confirmation !== null} title={t('deleteTitle')} closeLabel={t('close')}
      description={confirmation ? t('deleteDescription', { name: confirmation.name }) : ''}
      onClose={() => { if (!state.busy) setConfirmation(null) }}
      footer={<div className="skm-actions"><Button variant="outline" disabled={state.busy} data-modal-autofocus onClick={() => { setConfirmation(null) }}>{t('cancel')}</Button>
        <Button variant="outline" className="skm-danger" disabled={state.busy} onClick={() => { if (confirmation) void props.remove(confirmation).then(ok => { if (ok && alive.current) setConfirmation(null) }) }}>{t('delete')}</Button></div>} />
    <Modal open={editor !== null} title={t('editTitle')} closeLabel={t('close')} className="skm-editor"
      onClose={() => { if (!state.busy) setEditor(null) }}
      footer={<div className="skm-actions"><Button variant="outline" disabled={state.busy} onClick={() => { setEditor(null) }}>{t('cancel')}</Button>
        <Button variant="primary" disabled={state.busy} onClick={() => { void save() }}>{t('save')}</Button></div>}>
      {editor && <div className="skm-editor-content"><p className="skm-notice">{t('editHint')}</p><code className="skm-path">{editor.row.path}</code>
        <textarea className="skm-textarea" aria-label={t('file')} data-modal-autofocus spellCheck={false} value={editor.text} disabled={state.busy}
          onChange={event => { const text = event.target.value; setEditor(value => value ? { ...value, text, error: null } : value) }} />
        {editor.error && <p className="skm-notice skm-error" role="alert">{editor.error}</p>}
      </div>}
    </Modal>
  </section>
}

function Notice(props: InjectFace<Actions>) {
  const notice = props.useSkills(state => state.notice)
  return notice ? <Toast key={notice.id} text={notice.text} {...notice.error ? {} : { tone: 'success' as const }} holdMs={notice.error ? 6000 : 3000} onDone={() => { props.dismiss(notice.id) }} /> : null
}

export const name = 'skills-manager'
export const inject = ['slots', 'locale', 'connection', 'uiWorkspace', 'workspaces']

/** Register native settings and an operation notice that survives settings closing.
 * @param ctx Native Client services; navigation fills an unsubmitted draft.
 */
export function apply(ctx: Context): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { en, zh }))
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    return () => { style.remove() }
  })
  let state: State = { catalog: null, loading: false, busy: false, error: false, notice: null }
  let disposed = false, noticeId = 0, generation = 0
  const listeners = new Set<() => void>()
  const update = (value: Partial<State>) => {
    if (disposed) return
    state = { ...state, ...value }
    for (const listener of listeners) listener()
  }
  const store: Actions['hooks']['skills'] = { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } }
  const failure = (error: unknown) => t(error instanceof RequestError ? error.code : 'network')
  const notify = (text: string, error = false) => { update({ notice: { id: ++noticeId, text, error } }) }
  async function call<T>(method: Method, payload: object, schema: z.ZodType<T>): Promise<T> {
    let result
    try { result = await ctx.connection.rpc.call('/api', `${PREFIX}${method}`, payload) }
    catch (cause) { throw new RequestError('network') }
    if (!result.ok) throw new RequestError('network')
    const failed = Failure.safeParse(result.value)
    if (failed.success) throw new RequestError(failed.data.code)
    const success = z.object({ ok: z.literal(true), value: schema }).safeParse(result.value)
    if (!success.success) throw new RequestError('network')
    return success.data.value
  }
  const load = async () => {
    if (state.busy || disposed) return
    const current = ++generation
    update({ loading: true })
    try {
      const catalog = await call('list', {}, Catalog)
      if (current === generation) update({ catalog, error: false })
    } catch (error) { if (current === generation) update({ error: true }) }
    finally { if (current === generation) update({ loading: false }) }
  }
  const run = async (method: 'save' | 'delete' | 'toggle', row: SkillRow, fields: object, message: Key, throws = false) => {
    if (state.busy || disposed) return false
    ++generation
    update({ busy: true, loading: false })
    try {
      await call(method, { id: row.id, revision: row.revision, ...fields }, responses[method])
      notify(t(message))
      update({ busy: false })
      await load()
      if (state.error) notify(t('refreshError'), true)
      return true
    } catch (error) {
      notify(failure(error), true)
      if (throws) throw error
      return false
    } finally { update({ busy: false }) }
  }
  const actions: Actions = {
    hooks: { skills: store }, load, failure,
    read: async id => {
      try { return await call('read', { id }, responses.read) }
      catch (error) { notify(failure(error), true); throw error }
    },
    save: (row, text) => run('save', row, { text }, 'saved', true),
    remove: row => run('delete', row, {}, 'deleted'),
    toggle: row => run('toggle', row, { enabled: !row.enabled }, row.enabled ? 'turnedOff' : 'enabled'),
    create: projectId => {
      const workspaces = ctx.workspaces.list.getSnapshot()
      if (workspaces.phase !== 'ready' || workspaces.items.length === 0) { notify(t('noWorkspace'), true); return false }
      const selected = workspaces.items.find(row => row.workspaceId === projectId)
      const prompt = `${t('creatorDraft')}\n\n${selected ? t('projectDraft', { path: selected.path }) : ''}`.trim()
      try { ctx.uiWorkspace.startSession(selected?.workspaceId, { prompt, clearPreviousDraft: false }); return true }
      catch (error) { notify(failure(error), true); return false }
    },
    dismiss: id => { if (state.notice?.id === id) update({ notice: null }) },
  }
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'skills-manager', order: 26, label: () => t('nav'), locale: NS, inject: () => actions,
  }, SkillsPage)))
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'skills-manager.notice', inject: () => actions,
  }, Notice)))
  ctx.on('connection/reset', () => { update({ catalog: null }); void load() })
  ctx.effect(() => () => { disposed = true; generation++; listeners.clear() })
}
