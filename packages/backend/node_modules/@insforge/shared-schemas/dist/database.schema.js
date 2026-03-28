import { z } from 'zod';
export var ColumnType;
(function (ColumnType) {
    ColumnType["STRING"] = "string";
    ColumnType["DATE"] = "date";
    ColumnType["DATETIME"] = "datetime";
    ColumnType["INTEGER"] = "integer";
    ColumnType["FLOAT"] = "float";
    ColumnType["BOOLEAN"] = "boolean";
    ColumnType["UUID"] = "uuid";
    ColumnType["JSON"] = "json";
})(ColumnType || (ColumnType = {}));
export const onUpdateActionSchema = z.enum(['CASCADE', 'RESTRICT', 'NO ACTION']);
export const onDeleteActionSchema = z.enum([
    'CASCADE',
    'SET NULL',
    'SET DEFAULT',
    'RESTRICT',
    'NO ACTION',
]);
export const columnTypeSchema = z.enum([
    ColumnType.STRING,
    ColumnType.DATE,
    ColumnType.DATETIME,
    ColumnType.INTEGER,
    ColumnType.FLOAT,
    ColumnType.BOOLEAN,
    ColumnType.UUID,
    ColumnType.JSON,
]);
export const foreignKeySchema = z.object({
    referenceTable: z.string().min(1, 'Target table cannot be empty'),
    referenceColumn: z.string().min(1, 'Target column cannot be empty'),
    onDelete: onDeleteActionSchema,
    onUpdate: onUpdateActionSchema,
});
export const columnSchema = z.object({
    columnName: z
        .string()
        .min(1, 'Column name cannot be empty')
        .max(64, 'Column name must be less than 64 characters'),
    type: z.union([columnTypeSchema, z.string()]),
    defaultValue: z.string().optional(),
    isPrimaryKey: z.boolean().optional(),
    isNullable: z.boolean(),
    isUnique: z.boolean(),
    foreignKey: foreignKeySchema.optional(),
});
export const tableSchema = z.object({
    tableName: z
        .string()
        .min(1, 'Table name cannot be empty')
        .max(64, 'Table name must be less than 64 characters'),
    columns: z.array(columnSchema).min(1, 'At least one column is required'),
    recordCount: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});
// Database Metadata Object Schemas
export const databaseFunctionSchema = z.object({
    functionName: z.string(),
    functionDef: z.string(),
    kind: z.string(),
});
export const databaseIndexSchema = z.object({
    tableName: z.string(),
    indexName: z.string(),
    indexDef: z.string(),
    isUnique: z.boolean().nullable(),
    isPrimary: z.boolean().nullable(),
});
export const databasePolicySchema = z.object({
    tableName: z.string(),
    policyName: z.string(),
    cmd: z.string(),
    roles: z.array(z.string()),
    qual: z.string().nullable(),
    withCheck: z.string().nullable(),
});
export const databaseTriggerSchema = z.object({
    tableName: z.string(),
    triggerName: z.string(),
    actionTiming: z.string(),
    eventManipulation: z.string(),
    actionOrientation: z.string(),
    actionCondition: z.string().nullable(),
    actionStatement: z.string(),
});
//# sourceMappingURL=database.schema.js.map