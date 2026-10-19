/** Validated requests and responses for the authenticated settings API. */
import { z } from 'zod'

export const NS = 'skills-manager'
export const PREFIX = 'skills-manager/'
export const ErrorCode = z.enum([
  'invalid-request', 'invalid-skill', 'not-found', 'read-only', 'conflict',
  'file-too-large', 'io-failed', 'delete-incomplete', 'unloading', 'network',
])
export type ErrorCode = z.infer<typeof ErrorCode>
export const SkillRow = z.object({
  id: z.string(), name: z.string(), description: z.string(), path: z.string(),
  scope: z.enum(['global', 'project']), source: z.string(), project: z.string(), workspaceIds: z.array(z.string()),
  enabled: z.boolean(), modelInvocable: z.boolean(), userInvocable: z.boolean(),
  readOnly: z.boolean(), invalid: z.boolean(), revision: z.string(),
})
export type SkillRow = z.infer<typeof SkillRow>
export const Catalog = z.object({
  rows: z.array(SkillRow), warnings: z.array(z.string()),
  projects: z.array(z.object({ id: z.string(), title: z.string(), path: z.string() })),
})
export type Catalog = z.infer<typeof Catalog>
export const Mutation = z.object({ id: z.string().min(1), revision: z.string().min(1) })
export const requests = {
  list: z.object({}).strict(),
  read: z.object({ id: z.string().min(1) }).strict(),
  save: Mutation.extend({ text: z.string() }).strict(),
  toggle: Mutation.extend({ enabled: z.boolean() }).strict(),
  delete: Mutation.strict(),
}
export const responses = {
  list: Catalog,
  read: z.object({ row: SkillRow, text: z.string() }),
  save: z.object({}), toggle: z.object({}), delete: z.object({}),
}
export type Method = keyof typeof requests
export const Failure = z.object({ ok: z.literal(false), code: ErrorCode })
