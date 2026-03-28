'use client';

import { useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import {
  Columns2,
  AlignJustify,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Sparkles,
} from 'lucide-react';

interface DiffViewerProps {
  fix: {
    explanation: string;
    original_code?: string;
    fixed_code?: string;
    diff_patch?: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

const confidenceBadge: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  high: { icon: 'check', label: 'High Confidence', color: 'text-green-400', bg: 'bg-green-500/10' },
  medium: { icon: 'alert', label: 'Medium Confidence', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  low: { icon: 'question', label: 'Low Confidence', color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

function ConfidenceIcon({ level }: { level: string }) {
  switch (level) {
    case 'high':
      return <ShieldCheck className="w-4 h-4" />;
    case 'medium':
      return <ShieldAlert className="w-4 h-4" />;
    default:
      return <ShieldQuestion className="w-4 h-4" />;
  }
}

export function DiffViewer({ fix }: DiffViewerProps) {
  const [splitView, setSplitView] = useState(true);
  const badge = confidenceBadge[fix.confidence] ?? confidenceBadge.low;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Fix Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">AI-Generated Fix</span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${badge.color}`}>
          <ConfidenceIcon level={fix.confidence} />
          {badge.label}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Explanation */}
        {fix.explanation && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Explanation</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{fix.explanation}</p>
          </div>
        )}

        {/* Side-by-side diff */}
        {fix.original_code && fix.fixed_code && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-400">Code Changes</h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSplitView(true)}
                  className={`p-1.5 rounded transition-colors ${
                    splitView ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title="Split view"
                >
                  <Columns2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSplitView(false)}
                  className={`p-1.5 rounded transition-colors ${
                    !splitView ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title="Unified view"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-800 text-sm [&_table]:!bg-gray-950 [&_pre]:!bg-transparent [&_td]:!bg-gray-950 [&_.diff-gutter]:!bg-gray-900">
              <ReactDiffViewer
                oldValue={fix.original_code}
                newValue={fix.fixed_code}
                splitView={splitView}
                useDarkTheme={true}
                leftTitle="Original"
                rightTitle="Fixed"
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: '#030712',
                      diffViewerColor: '#d1d5db',
                      addedBackground: '#065f4620',
                      addedColor: '#4ade80',
                      removedBackground: '#7f1d1d20',
                      removedColor: '#f87171',
                      wordAddedBackground: '#065f4640',
                      wordRemovedBackground: '#7f1d1d40',
                      addedGutterBackground: '#065f4630',
                      removedGutterBackground: '#7f1d1d30',
                      gutterBackground: '#111827',
                      gutterBackgroundDark: '#0f172a',
                      highlightBackground: '#1e3a5f30',
                      highlightGutterBackground: '#1e3a5f20',
                      codeFoldGutterBackground: '#1f2937',
                      codeFoldBackground: '#1f2937',
                      emptyLineBackground: '#030712',
                      codeFoldContentColor: '#9ca3af',
                    },
                  },
                  contentText: {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  },
                }}
              />
            </div>
          </div>
        )}

        {/* Fallback: unified diff patch */}
        {fix.diff_patch && !(fix.original_code && fix.fixed_code) && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Patch</h4>
            <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
              <code className="text-xs text-gray-300 font-mono whitespace-pre">
                {fix.diff_patch}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
