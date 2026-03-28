'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { insforge } from '@/lib/insforge';
import { useUser } from '@/components/InsForgeProvider';
import { useScanRealtime } from '@/lib/useScanRealtime';
import { SCAN_STEPS, SCAN_STEP_LABELS } from '../../../../packages/shared/constants';
import { FindingsTable } from '@/components/FindingsTable';
import { SeverityChart } from '@/components/SeverityChart';
import type { ScanFinding } from '../../../../packages/shared/types/finding';
import {
  Shield,
  ArrowLeft,
  Scan,
  AlertTriangle,
  CheckCircle,
  Loader2,
  GitBranch,
  Clock,
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
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<ScanFinding | null>(null);
  const [loading, setLoading] = useState(true);

  const scanId = params.id as string;

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

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
      return;
    }
    if (user && scanId) {
      fetchScanData();
    }
  }, [user, isLoaded, scanId]);

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
                <span className="text-xl font-bold">SecForge</span>
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
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
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
        {findings.length > 0 && (
          <div className="space-y-6">
            {/* Severity chart */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4">Severity Breakdown</h2>
              <SeverityChart findings={findings} />
            </div>

            {/* Findings table */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4">Findings</h2>
              <FindingsTable findings={findings} onSelect={setSelectedFinding} />
            </div>
          </div>
        )}

        {/* Finding detail panel */}
        {selectedFinding && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedFinding(null)}>
            <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">{selectedFinding.title}</h3>
                  <p className="text-xs text-gray-500 font-mono">
                    {selectedFinding.file_path}{selectedFinding.line_start ? `:${selectedFinding.line_start}` : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedFinding(null)} className="text-gray-500 hover:text-white">&#x2715;</button>
              </div>
              {selectedFinding.description && (
                <p className="text-sm text-gray-300 mb-4">{selectedFinding.description}</p>
              )}
              <div className="flex items-center gap-3">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Generate AI Patch
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
