'use client';

import { useState, useEffect } from 'react';
import { insforge } from '@/lib/insforge';
import type { ScanFinding } from '../../packages/shared/types/finding';
import type { Fix } from '../../packages/shared/types/fix';
import { DiffViewer } from './DiffViewer';
import {
  AlertTriangle,
  FileCode,
  Package,
  Zap,
  Bug,
  ExternalLink,
  X,
  Loader2,
} from 'lucide-react';

interface FindingDetailProps {
  finding: ScanFinding;
  onClose: () => void;
}

const severityConfig: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  high: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  low: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  info: { color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
};

function getCategoryIcon(category: string) {
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
}

export function FindingDetail({ finding, onClose }: FindingDetailProps) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [loadingFix, setLoadingFix] = useState(true);

  useEffect(() => {
    const fetchFix = async () => {
      setLoadingFix(true);
      const { data } = await insforge.database
        .from('fixes')
        .select('*')
        .eq('finding_id', finding.id)
        .single();
      if (data) {
        setFix(data as Fix);
      }
      setLoadingFix(false);
    };
    fetchFix();
  }, [finding.id]);

  const severity = severityConfig[finding.severity] ?? severityConfig.info;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-lg pr-4">{finding.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Severity + Scanner + Category badges */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${severity.color} ${severity.bg} ${severity.border}`}
            >
              {finding.severity.toUpperCase()}
            </span>

            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              {getCategoryIcon(finding.scan_type)}
              <span className="uppercase">{finding.scan_type}</span>
            </span>

            <span className="text-xs text-gray-600">&middot;</span>
            <span className="text-xs text-gray-500">{finding.scanner}</span>

            {finding.cwe_id && (
              <>
                <span className="text-xs text-gray-600">&middot;</span>
                <a
                  href={`https://cwe.mitre.org/data/definitions/${finding.cwe_id.replace('CWE-', '')}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {finding.cwe_id}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}

            {finding.rule_id && (
              <>
                <span className="text-xs text-gray-600">&middot;</span>
                <span className="text-xs text-gray-500 font-mono">{finding.rule_id}</span>
              </>
            )}
          </div>

          {/* File Location */}
          {finding.file_path && (
            <div className="flex items-center gap-2 text-sm">
              <FileCode className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-300 font-mono text-xs truncate">
                {finding.file_path}
                {finding.line_start != null && (
                  <span className="text-gray-500">
                    :{finding.line_start}
                    {finding.line_end != null && finding.line_end !== finding.line_start && `-${finding.line_end}`}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Description */}
          {finding.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Description</h4>
              <p className="text-sm text-gray-300 leading-relaxed">{finding.description}</p>
            </div>
          )}

          {/* Fix Section */}
          {loadingFix ? (
            <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading fix...
            </div>
          ) : fix ? (
            <DiffViewer fix={fix} />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-400">
                No AI fix generated for this finding
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
