export interface ToolStatus {
    name: string;
    available: boolean;
    version?: string;
}
export declare function checkTools(): Promise<ToolStatus[]>;
