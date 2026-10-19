/** Native DSH Host: authenticated skill operations confined to configured and registered roots. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-workspace'
import { resolveAgentsHome, resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import schema from '@deepseek-ai/schemastery'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { PREFIX, requests, type Method } from './protocol.js'
import { projectRoot, SkillError, SkillFiles, type Root } from './skills.js'

export const name = 'skills-manager'
export const inject = ['connection', 'workspaceRegistry']

/** Skill roots must match the filesystem provider; other providers are not editable. */
export interface Config {
  dshHome?: string
  agentsHome?: string
  customSkillDirs?: string[]
  maxFileBytes?: number
}
export const Config = schema.object({
  dshHome: schema.string().description('DSH home override; match skill-filesystem when customized.'),
  agentsHome: schema.string().description('Shared agents home override; match skill-filesystem when customized.'),
  customSkillDirs: schema.array(schema.string()).default([]).description('Additional global skill roots; also configure the filesystem provider.'),
  maxFileBytes: schema.number().min(1024).default(1048576).description('Maximum editable instruction file size in bytes.'),
})

const envelope = z.object({ type: z.literal('client-request'), rpcId: z.string(), method: z.string(), payload: z.unknown() })

/** Register settings operations; admitted requests serialize and complete before unload.
 * @param ctx Host services supplied by DSH.
 * @param config Filesystem roots and edit size limit.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const home = resolveDshHome(config.dshHome), agents = resolveAgentsHome(config.agentsHome)
  const limit = config.maxFileBytes ?? 1048576
  if (!Number.isSafeInteger(limit) || limit < 1024) throw new Error('skills-manager: maxFileBytes must be an integer of at least 1024')
  const roots = async (): Promise<Root[]> => {
    const base = { scope: 'global' as const, project: '', workspaceIds: [], readOnly: false }
    const result: Root[] = [
      { ...base, path: join(home, 'skills'), source: 'user-dsh', skipSystem: true },
      { ...base, path: join(agents, 'skills'), source: 'user-agents' },
      ...(config.customSkillDirs ?? []).map(path => ({ ...base, path: resolve(path), source: 'custom' })),
    ]
    if (process.env.DSH_BUNDLED_SKILL_DIR) result.push({ ...base, path: resolve(process.env.DSH_BUNDLED_SKILL_DIR), source: 'bundled', readOnly: true })
    const projects = new Map<string, Root>()
    for (const workspace of ctx.workspaceRegistry.list()) {
      const path = await projectRoot(workspace.path)
      for (const [folder, source] of [['.dsh', 'project-dsh'], ['.agents', 'project-agents']] as const) {
        const key = join(path, folder, 'skills')
        const existing = projects.get(key)
        if (existing) { existing.workspaceIds.push(workspace.id); continue }
        projects.set(key, { path: key, scope: 'project', source, project: workspace.title, workspaceIds: [workspace.id], readOnly: false })
      }
    }
    return [...result, ...projects.values()]
  }
  const files = new SkillFiles(roots, limit)
  let closing = false
  let queue: Promise<unknown> = Promise.resolve()

  async function execute(method: Method, payload: unknown): Promise<unknown> {
    switch (method) {
      case 'list':
        requests.list.parse(payload)
        return { ...await files.list(), projects: ctx.workspaceRegistry.list().map(row => ({ id: row.id, title: row.title, path: row.path })) }
      case 'read': return files.read(requests.read.parse(payload).id)
      case 'save': await files.save(requests.save.parse(payload)); return {}
      case 'toggle': await files.toggle(requests.toggle.parse(payload)); return {}
      case 'delete': await files.delete(requests.delete.parse(payload)); return {}
    }
  }

  for (const method of Object.keys(requests) as Method[]) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: `/api/${PREFIX}${method}`, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'application/json') return new Response('Expected application/json', { status: 415 })
        let input: z.infer<typeof envelope>
        try {
          const raw: unknown = await request.json()
          input = envelope.parse(raw)
          if (input.method !== `${PREFIX}${method}` || !requests[method].safeParse(input.payload).success) throw new SkillError('invalid-request')
        } catch (error) { return new Response('Invalid skills request', { status: 400 }) }
        const task = closing ? Promise.reject(new SkillError('unloading')) : queue.then(() => execute(method, input.payload))
        queue = task.catch(_error => { /* The response below reports this error; subsequent requests must still run. */ })
        let value
        try { value = { ok: true, value: await task } }
        catch (error) {
          if (!(error instanceof SkillError)) ctx.logger.warn('Skills manager operation failed: %s', error)
          value = { ok: false, code: error instanceof SkillError ? error.code : error instanceof z.ZodError ? 'invalid-request' : 'io-failed' }
        }
        return Response.json({ type: 'server-response', rpcId: input.rpcId, result: { ok: true, value } })
      },
    }))
  }
  ctx.effect(() => async () => { closing = true; await queue })
}
