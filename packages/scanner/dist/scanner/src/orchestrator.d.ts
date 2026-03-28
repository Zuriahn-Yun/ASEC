export interface PipelineJob {
    id: string;
    repo_url: string;
    branch?: string;
    scan_types?: {
        sast?: boolean;
        sca?: boolean;
        dast?: boolean;
    };
}
export declare function runPipeline(job: PipelineJob): Promise<void>;
