/** Native DSH Host: authenticated skill operations confined to configured and registered roots. */
import type { Context } from '@deepseek-ai/cordis';
import schema from '@deepseek-ai/schemastery';
export declare const name = "skills-manager";
export declare const inject: string[];
/** Skill roots must match the filesystem provider; other providers are not editable. */
export interface Config {
    dshHome?: string;
    agentsHome?: string;
    customSkillDirs?: string[];
    maxFileBytes?: number;
}
export declare const Config: schema<Schemastery.ObjectS<NoInfer<{
    dshHome: schema<string, string, "plain">;
    agentsHome: schema<string, string, "plain">;
    customSkillDirs: schema<string[], string[], "defined">;
    maxFileBytes: schema<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    dshHome: schema<string, string, "plain">;
    agentsHome: schema<string, string, "plain">;
    customSkillDirs: schema<string[], string[], "defined">;
    maxFileBytes: schema<number, number, "defined">;
}>>, "plain">;
/** Register settings operations; admitted requests serialize and complete before unload.
 * @param ctx Host services supplied by DSH.
 * @param config Filesystem roots and edit size limit.
 */
export declare function apply(ctx: Context, config?: Config): void;
