'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { insforge } from '@/lib/insforge';
import { useUser } from '@/components/InsForgeProvider';
import { 
  Shield, 
  Github, 
  ArrowLeft, 
  Scan, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function NewScan() {
  const router = useRouter();
  const { user } = useUser();
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanOptions, setScanOptions] = useState({
    sast: true,
    sca: true,
    dast: false,
  });

  const extractRepoName = (url: string) => {
    try {
      const match = url.match(/github\.com\/[^/]+\/([^/]+)/);
      return match ? match[1].replace('.git', '') : 'unknown-repo';
    } catch {
      return 'unknown-repo';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/sign-in');
      return;
    }

    setLoading(true);
    setError('');

    const repoName = extractRepoName(repoUrl);

    // Create scan record in scan_jobs
    const { data: scan, error: scanError } = await insforge.database
      .from('scan_jobs')
      .insert([{
        user_id: user.id,
        repo_url: repoUrl,
        repo_name: repoName,
        status: 'queued',
        started_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (scanError) {
      setError('Failed to create scan: ' + scanError.message);
      setLoading(false);
      return;
    }

    // Trigger the start-scan serverless function
    const { error: fnError } = await insforge.functions.invoke('start-scan', {
      body: { repo_url: repoUrl },
    });

    if (fnError) {
      setError('Failed to start scan: ' + fnError.message);
      setLoading(false);
      return;
    }

    router.push(`/scan/${scan.id}`);
  };

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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Scan className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">New Security Scan</h1>
              <p className="text-gray-400">Analyze a GitHub repository for security vulnerabilities</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Repository URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                GitHub Repository URL
              </label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://github.com/username/repository"
                  required
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Enter the full GitHub URL of the repository you want to scan
              </p>
            </div>

            {/* Scan Options */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4">
                Scan Types
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-gray-950 rounded-lg border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={scanOptions.sast}
                    onChange={(e) => setScanOptions({ ...scanOptions, sast: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium">SAST (Static Analysis)</div>
                    <div className="text-sm text-gray-500">
                      Analyze source code for vulnerabilities using Bandit (Python) and Semgrep
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-950 rounded-lg border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={scanOptions.sca}
                    onChange={(e) => setScanOptions({ ...scanOptions, sca: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium">SCA (Dependency Scanning)</div>
                    <div className="text-sm text-gray-500">
                      Check for known vulnerabilities in dependencies using pip-audit and npm audit
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-950 rounded-lg border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={scanOptions.dast}
                    onChange={(e) => setScanOptions({ ...scanOptions, dast: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium">DAST (Dynamic Testing)</div>
                    <div className="text-sm text-gray-500">
                      Runtime security testing with OWASP ZAP and custom augmentation layer
                    </div>
                  </div>
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                    Beta
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !repoUrl}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting Scan...
                </>
              ) : (
                <>
                  <Scan className="w-5 h-5" />
                  Start Security Scan
                </>
              )}
            </button>
          </form>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-400">
              <p className="font-medium mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>We'll clone the repository to a secure environment</li>
                <li>Auto-detect the tech stack (Python or Node.js)</li>
                <li>Run selected security scans in parallel</li>
                <li>Generate AI-powered patches for found vulnerabilities</li>
                <li>All data is automatically cleaned up after scanning</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
