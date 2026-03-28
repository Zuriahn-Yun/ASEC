'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { insforge } from '@/lib/insforge';
import { useUser } from '@/components/InsForgeProvider';
import { useScanRealtime } from '@/lib/useScanRealtime';
import { SCAN_STEPS, SCAN_STEP_LABELS } from '../../../../packages/shared/constants';
import { FindingsTable } from '@/components/FindingsTable';
import { SeverityChart } from '@/components/SeverityChart';
import { FindingDetail } from '@/components/FindingDetail';
import type { ScanFinding } from '../../../../packages/shared/types/finding';
import type { ScanSummary } from '../../../../packages/shared/types/fix';
import {
  Shield,
  ArrowLeft,
  Scan,
  AlertTriangle,
  CheckCircle,
  Loader2,
  GitBranch,
  Download
} from 'lucide-react';
import Link from 'next/link';

interface ScanData {
  id: string;
  repo_url: string;
  repo_name: string;
  status: string;
  framework?: string;
  started_at?: string;
  completed_at?: string | null;
  error_message?: string;
}


export default function ScanDetail() {
  const params = useParams();
  const { isLoaded } = useUser();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedFinding, setSelectedFinding] = useState<ScanFinding | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const scanId = params.id as string;
  const hasSummary = Boolean(summary);
  const isCleanScan = scan?.status === 'complete' && (summary?.total_findings ?? 0) === 0;

  const fetchFindings = async () => {
    const { data } = await insforge.database
      .from('findings')
      .select('*')
      .eq('scan_id', scanId)
      .order('severity', { ascending: false });
    if (data) setFindings(data as ScanFinding[]);
  };

  const fetchScanData = async () => {
    const { data: scanData } = await insforge.database
      .from('scan_jobs')
      .select('*')
      .eq('id', scanId)
      .single();
    if (scanData) setScan(scanData as ScanData);

    const { data: summaryRows } = await insforge.database
      .from('scan_summaries')
      .select('*')
      .eq('scan_id', scanId);
    if (summaryRows && summaryRows.length > 0) setSummary(summaryRows[0] as ScanSummary);

    await fetchFindings();
    setLoading(false);
  };

  // Event-driven realtime subscription — no polling
  useScanRealtime(scanId, {
    onStatusChange: (status, error) => {
      setScan((prev) => prev ? { ...prev, status, error_message: error } : prev);
      if (status === 'complete') fetchScanData();
    },
    onFindingBatch: () => {
      fetchFindings();
    },
    onFixGenerated: () => {
      // Future: highlight findings that have a fix available
    },
  });

  const handleExport = async () => {
    if (!scan) return;
    setExporting(true);

    const [{ data: summaryData }, { data: findingsData }, { data: fixesData }] = await Promise.all([
      insforge.database.from('scan_summaries').select('*').eq('scan_id', scanId),
      insforge.database.from('findings').select('*').eq('scan_id', scanId).order('severity', { ascending: false }),
      insforge.database.from('fixes').select('*').eq('scan_id', scanId),
    ]);

    const report = {
      scan: {
        id: scan.id,
        repo_url: scan.repo_url,
        repo_name: scan.repo_name,
        status: scan.status,
        framework: scan.framework,
        started_at: scan.started_at,
        completed_at: scan.completed_at,
      },
      summary: (summaryData && summaryData.length > 0 ? summaryData[0] : null),
      findings: findingsData ?? [],
      fixes: fixesData ?? [],
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asec-report-${scan.repo_name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  useEffect(() => {
    if (scanId) {
      fetchScanData();
    }
  }, [scanId]);

  useEffect(() => {
    if (!scanId || !scan || scan.status === 'complete' || scan.status === 'failed') {
      return;
    }

    const interval = window.setInterval(() => {
      fetchScanData().catch(() => undefined);
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [scanId, scan?.status]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Scan Not Found</h1>
          <p className="text-gray-400 mb-6">The scan you&apos;re looking for doesn&apos;t exist</p>
          <Link
            href="/dashboard"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold">ASEC</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Scan Header */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Scan className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{scan.repo_name}</h1>
                <div className="flex items-center gap-2 text-gray-400 mt-1">
                  <GitBranch className="w-4 h-4" />
                  <span className="text-sm">{scan.repo_url}</span>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    scan.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                    ['cloning','detecting','booting','scanning_sast','scanning_dast','scanning_sca','analyzing','fixing'].includes(scan.status) ? 'bg-blue-500/20 text-blue-400' :
                    scan.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {getStatusIcon(scan.status)}
                    <span className="capitalize">{scan.status}</span>
                  </span>
                  {scan.framework && (
                    <span className="text-sm text-gray-500 capitalize">
                      Tech: {scan.framework}
                    </span>
                  )}
                  {scan.started_at && (
                    <span className="text-sm text-gray-500">
                      Started: {new Date(scan.started_at).toLocaleString()}
                    </span>
                  )}
                  {scan.completed_at && (
                    <span className="text-sm text-gray-500">
                      Completed: {new Date(scan.completed_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || scan.status !== 'complete'}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export Report
            </button>
          </div>

          {/* Pipeline Status Stepper */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {SCAN_STEPS.filter((s) => s !== 'queued').map((step, idx, arr) => {
                const currentIdx = SCAN_STEPS.indexOf(scan.status as typeof SCAN_STEPS[number]);
                const stepIdx = SCAN_STEPS.indexOf(step);
                const isDone = stepIdx < currentIdx;
                const isActive = step === scan.status;
                const isFailed = scan.status === 'failed' && isActive;

                return (
                  <div key={step} className="flex items-center gap-1 flex-shrink-0">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      isFailed ? 'bg-red-500/20 text-red-400' :
                      isActive ? 'bg-blue-500/20 text-blue-400' :
                      isDone ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-800 text-gray-500'
                    }`}>
                      {isActive && !isFailed && <Loader2 className="w-3 h-3 animate-spin" />}
                      {isDone && <CheckCircle className="w-3 h-3" />}
                      {isFailed && <AlertTriangle className="w-3 h-3" />}
                      {SCAN_STEP_LABELS[step]}
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`w-4 h-px flex-shrink-0 ${isDone ? 'bg-green-500' : 'bg-gray-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Finding count badge while scanning */}
        {findings.length > 0 && scan.status !== 'complete' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-3 mb-4 text-sm text-gray-400">
            <span className="font-medium text-white">{findings.length}</span> finding{findings.length !== 1 ? 's' : ''} found so far
          </div>
        )}

        {/* Findings — chart + table */}
        {(findings.length > 0 || summary) && (
          <div className="space-y-6">
            {hasSummary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <p className="text-sm text-gray-400">Total Findings</p>
                  <p className="mt-2 text-3xl font-bold">{summary?.total_findings ?? 0}</p>
                </div>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <p className="text-sm text-gray-400">SAST Findings</p>
                  <p className="mt-2 text-3xl font-bold">{summary?.sast_count ?? 0}</p>
                </div>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <p className="text-sm text-gray-400">SCA Findings</p>
                  <p className="mt-2 text-3xl font-bold">{summary?.sca_count ?? 0}</p>
                </div>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <p className="text-sm text-gray-400">DAST Findings</p>
                  <p className="mt-2 text-3xl font-bold">{summary?.dast_count ?? 0}</p>
                </div>
              </div>
            )}

            {isCleanScan && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-semibold text-green-300">Clean Report</h2>
                    <p className="text-sm text-green-200/90 mt-1">
                      No findings were detected in the scans that ran for this repository.
                      If the repo is not a runnable web app, DAST is expected to be skipped.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Severity chart from scan_summaries */}
            {summary && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Severity Breakdown
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    {summary.total_findings} total
                  </span>
                </h2>
                <SeverityChart summary={summary} findings={findings} />
              </div>
            )}

            {/* Findings table */}
            {findings.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold mb-4">Findings</h2>
                <FindingsTable
                  findings={findings}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  onFindingClick={(findingId) => {
                    const found = findings.find((f) => f.id === findingId);
                    if (found) setSelectedFinding(found);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Finding detail panel (slide-over) */}
        {selectedFinding && (
          <FindingDetail
            finding={selectedFinding}
            onClose={() => setSelectedFinding(null)}
          />
        )}
      </main>
    </div>
  );
}
