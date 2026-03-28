'use client';

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
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';

interface FindingDetailProps {
  finding: ScanFinding;
  fix?: Fix;
}

const severityConfig: Record<
  string,
  { color: string; bg: string; border: string }
> = {
  critical: {
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  high: {
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  medium: {
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  low: {
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  info: {
    color: 'text-gray-500',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
  },
};

const confidenceConfig: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  high: {
    icon: <ShieldCheck className="w-4 h-4" />,
    label: 'High Confidence',
    color: 'text-green-400',
  },
  medium: {
    icon: <ShieldAlert className="w-4 h-4" />,
    label: 'Medium Confidence',
    color: 'text-yellow-400',
  },
  low: {
    icon: <ShieldQuestion className="w-4 h-4" />,
    label: 'Low Confidence',
    color: 'text-orange-400',
  },
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

export function FindingDetail({ finding, fix }: FindingDetailProps) {
  const severity = severityConfig[finding.severity] ?? severityConfig.info;

  return (
    <div className="space-y-5">
      {/* Header: Severity + Scanner + Category */}
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
            <span className="text-xs text-gray-500 font-mono">
              {finding.rule_id}
            </span>
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
                {finding.line_end != null &&
                  finding.line_end !== finding.line_start &&
                  `-${finding.line_end}`}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Description */}
      {finding.description && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Description
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed">
            {finding.description}
          </p>
        </div>
      )}

      {/* AI Fix Section */}
      {fix && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
          {/* Fix Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-200">
                AI-Generated Fix
              </span>
            </div>
            {fix.confidence && confidenceConfig[fix.confidence] && (
              <div
                className={`flex items-center gap-1.5 text-xs ${confidenceConfig[fix.confidence].color}`}
              >
                {confidenceConfig[fix.confidence].icon}
                {confidenceConfig[fix.confidence].label}
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* AI Explanation */}
            {fix.explanation && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Explanation
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {fix.explanation}
                </p>
              </div>
            )}

            {/* Code Diff */}
            {fix.original_code && fix.fixed_code && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Code Changes
                </h4>
                <DiffViewer
                  oldCode={fix.original_code}
                  newCode={fix.fixed_code}
                />
              </div>
            )}

            {/* Patch (fallback if no structured code) */}
            {fix.diff_patch &&
              !(fix.original_code && fix.fixed_code) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Patch
                  </h4>
                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                    <code className="text-xs text-gray-300 font-mono whitespace-pre">
                      {fix.diff_patch}
                    </code>
                  </pre>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Alert icon when no fix available for critical/high */}
      {!fix &&
        (finding.severity === 'critical' || finding.severity === 'high') && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span className="text-xs text-yellow-400">
              No AI-generated fix available for this finding yet.
            </span>
          </div>
        )}
    </div>
  );
}
