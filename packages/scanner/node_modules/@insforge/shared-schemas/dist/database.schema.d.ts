import { z } from 'zod';
export declare enum ColumnType {
    STRING = "string",
    DATE = "date",
    DATETIME = "datetime",
    INTEGER = "integer",
    FLOAT = "float",
    BOOLEAN = "boolean",
    UUID = "uuid",
    JSON = "json"
}
export declare const onUpdateActionSchema: z.ZodEnum<["CASCADE", "RESTRICT", "NO ACTION"]>;
export declare const onDeleteActionSchema: z.ZodEnum<["CASCADE", "SET NULL", "SET DEFAULT", "RESTRICT", "NO ACTION"]>;
export declare const columnTypeSchema: z.ZodEnum<[ColumnType.STRING, ColumnType.DATE, ColumnType.DATETIME, ColumnType.INTEGER, ColumnType.FLOAT, ColumnType.BOOLEAN, ColumnType.UUID, ColumnType.JSON]>;
export declare const foreignKeySchema: z.ZodObject<{
    referenceTable: z.ZodString;
    referenceColumn: z.ZodString;
    onDelete: z.ZodEnum<["CASCADE", "SET NULL", "SET DEFAULT", "RESTRICT", "NO ACTION"]>;
    onUpdate: z.ZodEnum<["CASCADE", "RESTRICT", "NO ACTION"]>;
}, "strip", z.ZodTypeAny, {
    referenceTable: string;
    referenceColumn: string;
    onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
    onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
}, {
    referenceTable: string;
    referenceColumn: string;
    onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
    onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
}>;
export declare const columnSchema: z.ZodObject<{
    columnName: z.ZodString;
    type: z.ZodUnion<[z.ZodEnum<[ColumnType.STRING, ColumnType.DATE, ColumnType.DATETIME, ColumnType.INTEGER, ColumnType.FLOAT, ColumnType.BOOLEAN, ColumnType.UUID, ColumnType.JSON]>, z.ZodString]>;
    defaultValue: z.ZodOptional<z.ZodString>;
    isPrimaryKey: z.ZodOptional<z.ZodBoolean>;
    isNullable: z.ZodBoolean;
    isUnique: z.ZodBoolean;
    foreignKey: z.ZodOptional<z.ZodObject<{
        referenceTable: z.ZodString;
        referenceColumn: z.ZodString;
        onDelete: z.ZodEnum<["CASCADE", "SET NULL", "SET DEFAULT", "RESTRICT", "NO ACTION"]>;
        onUpdate: z.ZodEnum<["CASCADE", "RESTRICT", "NO ACTION"]>;
    }, "strip", z.ZodTypeAny, {
        referenceTable: string;
        referenceColumn: string;
        onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
        onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
    }, {
        referenceTable: string;
        referenceColumn: string;
        onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
        onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
    }>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    columnName: string;
    isNullable: boolean;
    isUnique: boolean;
    defaultValue?: string | undefined;
    isPrimaryKey?: boolean | undefined;
    foreignKey?: {
        referenceTable: string;
        referenceColumn: string;
        onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
        onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
    } | undefined;
}, {
    type: string;
    columnName: string;
    isNullable: boolean;
    isUnique: boolean;
    defaultValue?: string | undefined;
    isPrimaryKey?: boolean | undefined;
    foreignKey?: {
        referenceTable: string;
        referenceColumn: string;
        onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
        onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
    } | undefined;
}>;
export declare const tableSchema: z.ZodObject<{
    tableName: z.ZodString;
    columns: z.ZodArray<z.ZodObject<{
        columnName: z.ZodString;
        type: z.ZodUnion<[z.ZodEnum<[ColumnType.STRING, ColumnType.DATE, ColumnType.DATETIME, ColumnType.INTEGER, ColumnType.FLOAT, ColumnType.BOOLEAN, ColumnType.UUID, ColumnType.JSON]>, z.ZodString]>;
        defaultValue: z.ZodOptional<z.ZodString>;
        isPrimaryKey: z.ZodOptional<z.ZodBoolean>;
        isNullable: z.ZodBoolean;
        isUnique: z.ZodBoolean;
        foreignKey: z.ZodOptional<z.ZodObject<{
            referenceTable: z.ZodString;
            referenceColumn: z.ZodString;
            onDelete: z.ZodEnum<["CASCADE", "SET NULL", "SET DEFAULT", "RESTRICT", "NO ACTION"]>;
            onUpdate: z.ZodEnum<["CASCADE", "RESTRICT", "NO ACTION"]>;
        }, "strip", z.ZodTypeAny, {
            referenceTable: string;
            referenceColumn: string;
            onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
            onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
        }, {
            referenceTable: string;
            referenceColumn: string;
            onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
            onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        columnName: string;
        isNullable: boolean;
        isUnique: boolean;
        defaultValue?: string | undefined;
        isPrimaryKey?: boolean | undefined;
        foreignKey?: {
            referenceTable: string;
            referenceColumn: string;
            onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
            onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
        } | undefined;
    }, {
        type: string;
        columnName: string;
        isNullable: boolean;
        isUnique: boolean;
        defaultValue?: string | undefined;
        isPrimaryKey?: boolean | undefined;
        foreignKey?: {
            referenceTable: string;
            referenceColumn: string;
            onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
            onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
        } | undefined;
    }>, "many">;
    recordCount: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tableName: string;
    columns: {
        type: string;
        columnName: string;
        isNullable: boolean;
        isUnique: boolean;
        defaultValue?: string | undefined;
        isPrimaryKey?: boolean | undefined;
        foreignKey?: {
            referenceTable: string;
            referenceColumn: string;
            onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
            onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
        } | undefined;
    }[];
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    recordCount?: number | undefined;
}, {
    tableName: string;
    columns: {
        type: string;
        columnName: string;
        isNullable: boolean;
        isUnique: boolean;
        defaultValue?: string | undefined;
        isPrimaryKey?: boolean | undefined;
        foreignKey?: {
            referenceTable: string;
            referenceColumn: string;
            onDelete: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";
            onUpdate: "CASCADE" | "RESTRICT" | "NO ACTION";
        } | undefined;
    }[];
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    recordCount?: number | undefined;
}>;
export type TableSchema = z.infer<typeof tableSchema>;
export type ColumnSchema = z.infer<typeof columnSchema>;
export type ForeignKeySchema = z.infer<typeof foreignKeySchema>;
export type OnUpdateActionSchema = z.infer<typeof onUpdateActionSchema>;
export type OnDeleteActionSchema = z.infer<typeof onDeleteActionSchema>;
export declare const databaseFunctionSchema: z.ZodObject<{
    functionName: z.ZodString;
    functionDef: z.ZodString;
    kind: z.ZodString;
}, "strip", z.ZodTypeAny, {
    functionName: string;
    functionDef: string;
    kind: string;
}, {
    functionName: string;
    functionDef: string;
    kind: string;
}>;
export declare const databaseIndexSchema: z.ZodObject<{
    tableName: z.ZodString;
    indexName: z.ZodString;
    indexDef: z.ZodString;
    isUnique: z.ZodNullable<z.ZodBoolean>;
    isPrimary: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isUnique: boolean | null;
    tableName: string;
    indexName: string;
    indexDef: string;
    isPrimary: boolean | null;
}, {
    isUnique: boolean | null;
    tableName: string;
    indexName: string;
    indexDef: string;
    isPrimary: boolean | null;
}>;
export declare const databasePolicySchema: z.ZodObject<{
    tableName: z.ZodString;
    policyName: z.ZodString;
    cmd: z.ZodString;
    roles: z.ZodArray<z.ZodString, "many">;
    qual: z.ZodNullable<z.ZodString>;
    withCheck: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tableName: string;
    policyName: string;
    cmd: string;
    roles: string[];
    qual: string | null;
    withCheck: string | null;
}, {
    tableName: string;
    policyName: string;
    cmd: string;
    roles: string[];
    qual: string | null;
    withCheck: string | null;
}>;
export declare const databaseTriggerSchema: z.ZodObject<{
    tableName: z.ZodString;
    triggerName: z.ZodString;
    actionTiming: z.ZodString;
    eventManipulation: z.ZodString;
    actionOrientation: z.ZodString;
    actionCondition: z.ZodNullable<z.ZodString>;
    actionStatement: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tableName: string;
    triggerName: string;
    actionTiming: string;
    eventManipulation: string;
    actionOrientation: string;
    actionCondition: string | null;
    actionStatement: string;
}, {
    tableName: string;
    triggerName: string;
    actionTiming: string;
    eventManipulation: string;
    actionOrientation: string;
    actionCondition: string | null;
    actionStatement: string;
}>;
export type DatabaseFunction = z.infer<typeof databaseFunctionSchema>;
export type DatabaseIndex = z.infer<typeof databaseIndexSchema>;
export type DatabasePolicy = z.infer<typeof databasePolicySchema>;
export type DatabaseTrigger = z.infer<typeof databaseTriggerSchema>;
//# sourceMappingURL=database.schema.d.ts.map