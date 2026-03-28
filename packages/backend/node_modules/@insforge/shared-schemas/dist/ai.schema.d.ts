import { z } from 'zod';
export declare const modalitySchema: z.ZodEnum<["text", "image", "audio"]>;
export declare const aiConfigurationInputSchema: z.ZodObject<{
    inputModality: z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">;
    outputModality: z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">;
    provider: z.ZodString;
    modelId: z.ZodString;
    systemPrompt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    inputModality: ("text" | "image" | "audio")[];
    outputModality: ("text" | "image" | "audio")[];
    provider: string;
    modelId: string;
    systemPrompt?: string | undefined;
}, {
    inputModality: ("text" | "image" | "audio")[];
    outputModality: ("text" | "image" | "audio")[];
    provider: string;
    modelId: string;
    systemPrompt?: string | undefined;
}>;
export declare const aiConfigurationSchema: z.ZodObject<{
    inputModality: z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">;
    outputModality: z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">;
    provider: z.ZodString;
    modelId: z.ZodString;
    systemPrompt: z.ZodOptional<z.ZodString>;
} & {
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    inputModality: ("text" | "image" | "audio")[];
    outputModality: ("text" | "image" | "audio")[];
    provider: string;
    modelId: string;
    id: string;
    systemPrompt?: string | undefined;
}, {
    inputModality: ("text" | "image" | "audio")[];
    outputModality: ("text" | "image" | "audio")[];
    provider: string;
    modelId: string;
    id: string;
    systemPrompt?: string | undefined;
}>;
export declare const aiConfigurationWithUsageSchema: z.ZodObject<{
    inputModality: z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">;
    outputModality: z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">;
    provider: z.ZodString;
    modelId: z.ZodString;
    systemPrompt: z.ZodOptional<z.ZodString>;
} & {
    id: z.ZodString;
} & {
    usageStats: z.ZodOptional<z.ZodObject<{
        totalInputTokens: z.ZodNumber;
        totalOutputTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
        totalImageCount: z.ZodNumber;
        totalRequests: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        totalImageCount: number;
        totalRequests: number;
    }, {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        totalImageCount: number;
        totalRequests: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    inputModality: ("text" | "image" | "audio")[];
    outputModality: ("text" | "image" | "audio")[];
    provider: string;
    modelId: string;
    id: string;
    systemPrompt?: string | undefined;
    usageStats?: {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        totalImageCount: number;
        totalRequests: number;
    } | undefined;
}, {
    inputModality: ("text" | "image" | "audio")[];
    outputModality: ("text" | "image" | "audio")[];
    provider: string;
    modelId: string;
    id: string;
    systemPrompt?: string | undefined;
    usageStats?: {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        totalImageCount: number;
        totalRequests: number;
    } | undefined;
}>;
export declare const aiUsageDataSchema: z.ZodObject<{
    configId: z.ZodString;
    inputTokens: z.ZodOptional<z.ZodNumber>;
    outputTokens: z.ZodOptional<z.ZodNumber>;
    imageCount: z.ZodOptional<z.ZodNumber>;
    imageResolution: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    configId: string;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    imageCount?: number | undefined;
    imageResolution?: string | undefined;
}, {
    configId: string;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    imageCount?: number | undefined;
    imageResolution?: string | undefined;
}>;
export declare const aiUsageRecordSchema: z.ZodObject<{
    configId: z.ZodString;
    inputTokens: z.ZodOptional<z.ZodNumber>;
    outputTokens: z.ZodOptional<z.ZodNumber>;
    imageCount: z.ZodOptional<z.ZodNumber>;
    imageResolution: z.ZodOptional<z.ZodString>;
} & {
    id: z.ZodString;
    createdAt: z.ZodDate;
    modelId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    model: z.ZodNullable<z.ZodString>;
    provider: z.ZodNullable<z.ZodString>;
    inputModality: z.ZodNullable<z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">>;
    outputModality: z.ZodNullable<z.ZodArray<z.ZodEnum<["text", "image", "audio"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    inputModality: ("text" | "image" | "audio")[] | null;
    outputModality: ("text" | "image" | "audio")[] | null;
    provider: string | null;
    id: string;
    configId: string;
    createdAt: Date;
    model: string | null;
    modelId?: string | null | undefined;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    imageCount?: number | undefined;
    imageResolution?: string | undefined;
}, {
    inputModality: ("text" | "image" | "audio")[] | null;
    outputModality: ("text" | "image" | "audio")[] | null;
    provider: string | null;
    id: string;
    configId: string;
    createdAt: Date;
    model: string | null;
    modelId?: string | null | undefined;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    imageCount?: number | undefined;
    imageResolution?: string | undefined;
}>;
export declare const aiUsageSummarySchema: z.ZodObject<{
    totalInputTokens: z.ZodNumber;
    totalOutputTokens: z.ZodNumber;
    totalTokens: z.ZodNumber;
    totalImageCount: z.ZodNumber;
    totalRequests: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalImageCount: number;
    totalRequests: number;
}, {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalImageCount: number;
    totalRequests: number;
}>;
export type ModalitySchema = z.infer<typeof modalitySchema>;
export type AIConfigurationInputSchema = z.infer<typeof aiConfigurationInputSchema>;
export type AIConfigurationSchema = z.infer<typeof aiConfigurationSchema>;
export type AIConfigurationWithUsageSchema = z.infer<typeof aiConfigurationWithUsageSchema>;
export type AIUsageDataSchema = z.infer<typeof aiUsageDataSchema>;
export type AIUsageRecordSchema = z.infer<typeof aiUsageRecordSchema>;
export type AIUsageSummarySchema = z.infer<typeof aiUsageSummarySchema>;
//# sourceMappingURL=ai.schema.d.ts.map