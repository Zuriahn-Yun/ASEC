'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { insforge } from '@/lib/insforge';
import { useUser } from '@/components/InsForgeProvider';
import { useRealtimeScan } from '@/hooks/useRealtimeScan';
import { SCAN_STEPS, SCAN_STEP_LABELS } from '../../../../packages/shared/constants';
import { 
  Shield, 
  ArrowLeft, 
  Scan, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  GitBranch,
  Clock,
  FileCode,
  Bug,
  Package,
  Zap,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';
import Link from 'next/link';

interface Scan {
  id: string;
  repo_url: string;
  repo_name: string;
  status: string;
  tech_stack: string;
  started_at: string;
  completed_at: string | null;
  sast_status: string;
  sca_status: string;
  dast_status: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'sast' | 'sca' | 'dast';
  file_path: string;
  line_number: number;
  code_snippet: string;
  remediation: string;
  tool: string;
  status: string;
}

export default function ScanDetail() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const scanId = params.id as string;

  // Realtime status + live findings
  const { status: realtimeStatus, findings: realtimeFindings } = useRealtimeScan(
    user ? scanId : null,
  );

  // Merge realtime findings into local state
  useEffect(() => {
    if (realtimeFindings.length > 0) {
      setFindings(realtimeFindings as unknown as Finding[]);
    }
  }, [realtimeFindings]);

  // Keep scan status in sync with realtime
  useEffect(() => {
    if (scan && realtimeStatus) {
      setScan((prev) => prev ? { ...prev, status: realtimeStatus } : prev);
    }
  }, [realtimeStatus]);

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
      return;
    }
    if (user && scanId) {
      fetchScanData();
    }
  }, [user, isLoaded, scanId]);

  const fetchScanData = async () => {
    // Fetch scan details
    const { data: scanData } = await insforge.database
      .from('scan_jobs')
      .select('*')
      .eq('id', scanId)
      .single();

    if (scanData) {
      setScan(scanData as Scan);
    }

    // Fetch findings
    const { data: findingsData } = await insforge.database
      .from('findings')
      .select('*')
      .eq('scan_id', scanId)
      .order('severity', { ascending: false });

    if (findingsData) {
      setFindings(findingsData as Finding[]);
    }

    setLoading(false);
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'text-red-500 bg-red-500/10 border-red-500/20',
      high: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
      medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
      low: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      info: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
    };
    return colors[severity as keyof typeof colors] || colors.info;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sast':
        return <FileCode className="w-4 h-4" />;
      case 'sca':
        return <Package className="w-4 h-4" />;
      case 'dast':
        return <Zap className="w-4 h-4" />;
      default:
        return <Bug className="w-4 h-4" />;
    }
  };

  const filteredFindings = activeFilter === 'all' 
    ? findings 
    : findings.filter(f => f.category === activeFilter);

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
          <p className="text-gray-400 mb-6">The scan you're looking for doesn't exist</p>
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
                  <span className="text-sm text-gray-500 capitalize">
                    Tech: {scan.tech_stack || 'Unknown'}
                  </span>
                  <span className="text-sm text-gray-500">
                    Started: {new Date(scan.started_at).toLocaleString()}
                  </span>
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

        {/* Findings Summary */}
        {scan.status === 'complete' && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
              <p className="text-2xl font-bold">{scan.total_findings}</p>
              <p className="text-sm text-gray-400">Total</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20 text-center">
              <p className="text-2xl font-bold text-red-500">{scan.critical_count}</p>
              <p className="text-sm text-red-400">Critical</p>
            </div>
            <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20 text-center">
              <p className="text-2xl font-bold text-orange-500">{scan.high_count}</p>
              <p className="text-sm text-orange-400">High</p>
            </div>
            <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20 text-center">
              <p className="text-2xl font-bold text-yellow-500">{scan.medium_count}</p>
              <p className="text-sm text-yellow-400">Medium</p>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 text-center">
              <p className="text-2xl font-bold text-blue-500">{scan.low_count}</p>
              <p className="text-sm text-blue-400">Low</p>
            </div>
          </div>
        )}

        {/* Findings List */}
        {scan.status === 'complete' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Findings</h2>
              <div className="flex items-center gap-2">
                {['all', 'sast', 'sca', 'dast'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      activeFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {filteredFindings.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium mb-2">No Findings</h3>
                <p className="text-gray-400">Great! No vulnerabilities were found in this scan.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filteredFindings.map((finding) => (
                  <div key={finding.id} className="p-4">
                    <button
                      onClick={() => setExpandedFinding(
                        expandedFinding === finding.id ? null : finding.id
                      )}
                      className="w-full flex items-start gap-4 text-left"
                    >
                      <div className={`flex-shrink-0 w-20 text-center px-2 py-1 rounded border text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                        {finding.severity.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(finding.category)}
                          <span className="text-xs text-gray-500 uppercase">{finding.category}</span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">{finding.tool}</span>
                        </div>
                        <h3 className="font-medium mt-1">{finding.title}</h3>
                        {finding.file_path && (
                          <p className="text-sm text-gray-500 mt-1">
                            {finding.file_path}:{finding.line_number}
                          </p>
                        )}
                      </div>
                      {expandedFinding === finding.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </button>

                    {expandedFinding === finding.id && (
                      <div className="mt-4 ml-24 space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Description</h4>
                          <p className="text-sm text-gray-300">{finding.description}</p>
                        </div>
                        
                        {finding.code_snippet && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Code Snippet</h4>
                            <pre className="bg-gray-950 p-4 rounded-lg overflow-x-auto">
                              <code className="text-sm text-gray-300">{finding.code_snippet}</code>
                            </pre>
                          </div>
                        )}

                        {finding.remediation && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Remediation</h4>
                            <p className="text-sm text-gray-300">{finding.remediation}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-4">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            Generate AI Patch
                          </button>
                          <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            Mark as False Positive
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
