export type ScanStatus =
  | 'queued'
  | 'cloning'
  | 'detecting'
  | 'booting'
  | 'scanning_sast'
  | 'scanning_dast'
  | 'scanning_sca'
  | 'analyzing'
  | 'fixing'
  | 'complete'
  | 'failed';

export interface ScanJob {
  id: string;
  user_id: string;
  repo_url: string;
  repo_name: string;
  status: ScanStatus;
  framework?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface ScanRequest {
  repo_url: string;
  branch?: string;
}
