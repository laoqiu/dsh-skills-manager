/** Validated requests and responses for the authenticated settings API. */
import { z } from 'zod';
export declare const NS = "skills-manager";
export declare const PREFIX = "skills-manager/";
export declare const ErrorCode: z.ZodEnum<{
    "invalid-request": "invalid-request";
    "invalid-skill": "invalid-skill";
    "not-found": "not-found";
    "read-only": "read-only";
    conflict: "conflict";
    "file-too-large": "file-too-large";
    "io-failed": "io-failed";
    "delete-incomplete": "delete-incomplete";
    unloading: "unloading";
    network: "network";
}>;
export type ErrorCode = z.infer<typeof ErrorCode>;
export declare const SkillRow: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    path: z.ZodString;
    scope: z.ZodEnum<{
        global: "global";
        project: "project";
    }>;
    source: z.ZodString;
    project: z.ZodString;
    workspaceIds: z.ZodArray<z.ZodString>;
    enabled: z.ZodBoolean;
    modelInvocable: z.ZodBoolean;
    userInvocable: z.ZodBoolean;
    readOnly: z.ZodBoolean;
    invalid: z.ZodBoolean;
    revision: z.ZodString;
}, z.core.$strip>;
export type SkillRow = z.infer<typeof SkillRow>;
export declare const Catalog: z.ZodObject<{
    rows: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        path: z.ZodString;
        scope: z.ZodEnum<{
            global: "global";
            project: "project";
        }>;
        source: z.ZodString;
        project: z.ZodString;
        workspaceIds: z.ZodArray<z.ZodString>;
        enabled: z.ZodBoolean;
        modelInvocable: z.ZodBoolean;
        userInvocable: z.ZodBoolean;
        readOnly: z.ZodBoolean;
        invalid: z.ZodBoolean;
        revision: z.ZodString;
    }, z.core.$strip>>;
    warnings: z.ZodArray<z.ZodString>;
    projects: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        path: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Catalog = z.infer<typeof Catalog>;
export declare const Mutation: z.ZodObject<{
    id: z.ZodString;
    revision: z.ZodString;
}, z.core.$strip>;
export declare const requests: {
    list: z.ZodObject<{}, z.core.$strict>;
    read: z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strict>;
    save: z.ZodObject<{
        id: z.ZodString;
        revision: z.ZodString;
        text: z.ZodString;
    }, z.core.$strict>;
    toggle: z.ZodObject<{
        id: z.ZodString;
        revision: z.ZodString;
        enabled: z.ZodBoolean;
    }, z.core.$strict>;
    delete: z.ZodObject<{
        id: z.ZodString;
        revision: z.ZodString;
    }, z.core.$strict>;
};
export declare const responses: {
    list: z.ZodObject<{
        rows: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodString;
            path: z.ZodString;
            scope: z.ZodEnum<{
                global: "global";
                project: "project";
            }>;
            source: z.ZodString;
            project: z.ZodString;
            workspaceIds: z.ZodArray<z.ZodString>;
            enabled: z.ZodBoolean;
            modelInvocable: z.ZodBoolean;
            userInvocable: z.ZodBoolean;
            readOnly: z.ZodBoolean;
            invalid: z.ZodBoolean;
            revision: z.ZodString;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
        projects: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            path: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    read: z.ZodObject<{
        row: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodString;
            path: z.ZodString;
            scope: z.ZodEnum<{
                global: "global";
                project: "project";
            }>;
            source: z.ZodString;
            project: z.ZodString;
            workspaceIds: z.ZodArray<z.ZodString>;
            enabled: z.ZodBoolean;
            modelInvocable: z.ZodBoolean;
            userInvocable: z.ZodBoolean;
            readOnly: z.ZodBoolean;
            invalid: z.ZodBoolean;
            revision: z.ZodString;
        }, z.core.$strip>;
        text: z.ZodString;
    }, z.core.$strip>;
    save: z.ZodObject<{}, z.core.$strip>;
    toggle: z.ZodObject<{}, z.core.$strip>;
    delete: z.ZodObject<{}, z.core.$strip>;
};
export type Method = keyof typeof requests;
export declare const Failure: z.ZodObject<{
    ok: z.ZodLiteral<false>;
    code: z.ZodEnum<{
        "invalid-request": "invalid-request";
        "invalid-skill": "invalid-skill";
        "not-found": "not-found";
        "read-only": "read-only";
        conflict: "conflict";
        "file-too-large": "file-too-large";
        "io-failed": "io-failed";
        "delete-incomplete": "delete-incomplete";
        unloading: "unloading";
        network: "network";
    }>;
}, z.core.$strip>;
