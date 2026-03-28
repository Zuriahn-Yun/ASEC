import { z } from 'zod';
/**
 * Deployment status enum schema
 * WAITING -> UPLOADING -> (Vercel statuses: QUEUED/BUILDING/READY/ERROR/CANCELED)
 */
export declare const deploymentStatusSchema: z.ZodEnum<["WAITING", "UPLOADING", "QUEUED", "BUILDING", "READY", "ERROR", "CANCELED"]>;
export type DeploymentStatusType = z.infer<typeof deploymentStatusSchema>;
export declare const deploymentSchema: z.ZodObject<{
    id: z.ZodString;
    providerDeploymentId: z.ZodNullable<z.ZodString>;
    provider: z.ZodString;
    status: z.ZodEnum<["WAITING", "UPLOADING", "QUEUED", "BUILDING", "READY", "ERROR", "CANCELED"]>;
    url: z.ZodNullable<z.ZodString>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "WAITING" | "UPLOADING" | "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
    provider: string;
    id: string;
    createdAt: string;
    url: string | null;
    metadata: Record<string, unknown> | null;
    updatedAt: string;
    providerDeploymentId: string | null;
}, {
    status: "WAITING" | "UPLOADING" | "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
    provider: string;
    id: string;
    createdAt: string;
    url: string | null;
    metadata: Record<string, unknown> | null;
    updatedAt: string;
    providerDeploymentId: string | null;
}>;
export type DeploymentSchema = z.infer<typeof deploymentSchema>;
//# sourceMappingURL=deployments.schema.d.ts.map