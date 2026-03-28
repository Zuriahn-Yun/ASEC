'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/components/InsForgeProvider';
import { insforge } from '@/lib/insforge';
import {
  Shield,
  Scan,
  AlertTriangle,
  CheckCircle,
  GitBranch,
  Clock,
  ChevronRight,
  Plus,
  LogOut
} from 'lucide-react';
import Link from 'next/link';

interface ScanJobRow {
  id: string;
  repo_url: string;
  repo_name: string;
  status: string;
  framework: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface SummaryRow {
  scan_id: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  fixes_generated: number;
}

interface ScanWithSummary extends ScanJobRow {
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

export default function Dashboard() {
  const { user, isLoaded, signOut } = useUser();
  const [scans, setScans] = useState<ScanWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalScans: 0,
    totalFindings: 0,
    criticalFindings: 0,
    fixedIssues: 0,
  });

  useEffect(() => {
    if (user) {
      fetchScans();
    }
  }, [user]);

  const fetchScans = async () => {
    const { data: jobs, error: jobsError } = await insforge.database
      .from('scan_jobs')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (!jobs) {
      setLoading(false);
      return;
    }

    const ids = jobs.map((j: ScanJobRow) => j.id);
    const { data: summaries } = await insforge.database
      .from('scan_summaries')
      .select('*')
      .in('scan_id', ids);

    const summaryMap = new Map<string, SummaryRow>();
    if (summaries) {
      for (const s of summaries as SummaryRow[]) {
        summaryMap.set(s.scan_id, s);
      }
    }

    const merged: ScanWithSummary[] = jobs.map((j: ScanJobRow) => {
      const s = summaryMap.get(j.id);
      return {
        ...j,
        total_findings: s?.total_findings ?? 0,
        critical_count: s?.critical_count ?? 0,
        high_count: s?.high_count ?? 0,
        medium_count: s?.medium_count ?? 0,
        low_count: s?.low_count ?? 0,
      };
    });

    setScans(merged);
    calculateStats(merged);
    setLoading(false);
  };

  const calculateStats = (scanData: ScanWithSummary[]) => {
    const totalScans = scanData.length;
    const totalFindings = scanData.reduce((sum, scan) => sum + scan.total_findings, 0);
    const criticalFindings = scanData.reduce((sum, scan) => sum + scan.critical_count, 0);
    
    setStats({
      totalScans,
      totalFindings,
      criticalFindings,
      fixedIssues: 0,
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      complete: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
      queued: 'bg-yellow-500/20 text-yellow-400',
    };
    return styles[status] || 'bg-blue-500/20 text-blue-400';
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-blue-500" />
          <h1 className="text-2xl font-bold mb-4">Welcome to ASEC</h1>
          <p className="text-gray-400 mb-6">Please sign in to access your security dashboard</p>
          <Link 
            href="/sign-in"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Sign In
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
              <Shield className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold">ASEC</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-400">{user.email}</span>
              <button
                onClick={signOut}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Scans</p>
                <p className="text-3xl font-bold mt-1">{stats.totalScans}</p>
              </div>
              <Scan className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Findings</p>
                <p className="text-3xl font-bold mt-1">{stats.totalFindings}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-yellow-500" />
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Critical Issues</p>
                <p className="text-3xl font-bold mt-1 text-red-500">{stats.criticalFindings}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Fixed Issues</p>
                <p className="text-3xl font-bold mt-1 text-green-500">{stats.fixedIssues}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Scans</h2>
          <Link
            href="/scan/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Scan
          </Link>
        </div>

        {/* Scans Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : scans.length === 0 ? (
            <div className="p-12 text-center">
              <Scan className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-medium mb-2">No scans yet</h3>
              <p className="text-gray-400 mb-6">Start your first security scan to analyze a repository</p>
              <Link
                href="/scan/new"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Start New Scan
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Repository</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Framework</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Findings</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Started</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <GitBranch className="w-5 h-5 text-gray-500" />
                          <div>
                            <p className="font-medium">{scan.repo_name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-xs">{scan.repo_url}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(scan.status)}`}>
                          {scan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm capitalize">{scan.framework || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {scan.total_findings > 0 ? (
                            <>
                              {scan.critical_count > 0 && (
                                <span className="text-red-500 font-medium">{scan.critical_count}C</span>
                              )}
                              {scan.high_count > 0 && (
                                <span className="text-orange-500 font-medium">{scan.high_count}H</span>
                              )}
                              {scan.medium_count > 0 && (
                                <span className="text-yellow-500 font-medium">{scan.medium_count}M</span>
                              )}
                              {scan.low_count > 0 && (
                                <span className="text-blue-500 font-medium">{scan.low_count}L</span>
                              )}
                            </>
                          ) : (
                            <span className="text-green-500 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              Clean
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">
                            {scan.started_at ? new Date(scan.started_at).toLocaleDateString() : new Date(scan.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/scan/${scan.id}`}
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
