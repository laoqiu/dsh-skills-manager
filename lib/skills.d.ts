import type { Catalog, ErrorCode, SkillRow } from './protocol.js';
/** A declared skills directory; project directories come from the Workspace registry. */
export interface Root {
    path: string;
    scope: 'global' | 'project';
    source: string;
    project: string;
    workspaceIds: string[];
    readOnly: boolean;
    skipSystem?: boolean;
}
/** A refused operation has no mutation, except delete-incomplete which can remove resource files. */
export declare class SkillError extends Error {
    readonly code: ErrorCode;
    constructor(code: ErrorCode, options?: ErrorOptions);
}
/** Locate the nearest Git root, matching DSH filesystem skill discovery.
 * @param cwd Workspace directory.
 * @returns Git root, or the workspace itself when none exists.
 */
export declare function projectRoot(cwd: string): Promise<string>;
/** Rewrite only invocation controls and their restore marker.
 * @param text Current complete SKILL.md.
 * @param enabled False disables both entry points; true restores the prior policy, or enables both if none was saved.
 * @returns Valid complete skill text retaining other YAML fields and body.
 */
export declare function toggleText(text: string, enabled: boolean): string;
/** Repository for explicitly supplied filesystem roots; mutations re-discover IDs and check revisions. */
export declare class SkillFiles {
    private readonly roots;
    private readonly maxFileBytes;
    constructor(roots: () => Promise<Root[]>, maxFileBytes: number);
    private discover;
    /** List physical entries, including disabled, invalid and shadowed copies.
     * @returns Rows and directories that could not be read; bundled and linked entries are read-only.
     */
    list(): Promise<Pick<Catalog, 'rows' | 'warnings'>>;
    private readText;
    private entry;
    /** Read an authorized catalog entry.
     * @param id Server-issued entry ID.
     * @returns Current row, revision and full instruction file.
     */
    read(id: string): Promise<{
        row: SkillRow;
        text: string;
    }>;
    private write;
    /** Save a validated instruction file without renaming its resource directory.
     * @param input Entry ID, expected revision and full Markdown text.
     * @returns Completion after replacement; stale revisions leave the original file intact.
     */
    save(input: {
        id: string;
        revision: string;
        text: string;
    }): Promise<void>;
    /** Persist the invocation policy change.
     * @param input Entry identity, expected revision and desired enabled state.
     * @returns Completion after atomic file replacement.
     */
    toggle(input: {
        id: string;
        revision: string;
        enabled: boolean;
    }): Promise<void>;
    /** Delete one flat file or the skill directory with its resources; nested links are only unlinked.
     * @param input Entry identity and expected revision.
     * @returns Completion after removal; delete-incomplete may leave partially removed resources and keeps SKILL.md when possible.
     */
    delete(input: {
        id: string;
        revision: string;
    }): Promise<void>;
}
