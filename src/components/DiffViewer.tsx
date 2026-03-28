'use client';

import { useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Columns2, AlignJustify } from 'lucide-react';

interface DiffViewerProps {
  oldCode: string;
  newCode: string;
}

export function DiffViewer({ oldCode, newCode }: DiffViewerProps) {
  const [splitView, setSplitView] = useState(true);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400">Code Diff</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSplitView(true)}
            className={`p-1.5 rounded transition-colors ${
              splitView
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Split view"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSplitView(false)}
            className={`p-1.5 rounded transition-colors ${
              !splitView
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Unified view"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="text-sm [&_table]:!bg-gray-950 [&_pre]:!bg-transparent [&_td]:!bg-gray-950 [&_.diff-gutter]:!bg-gray-900">
        <ReactDiffViewer
          oldValue={oldCode}
          newValue={newCode}
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
  );
}
