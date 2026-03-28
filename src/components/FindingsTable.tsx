'use client';

import { useState, Fragment } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import type { ScanFinding, SeverityLevel } from '../../packages/shared/types/finding';

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

type SortDir = 'asc' | 'desc';

interface FindingsTableProps {
  findings: ScanFinding[];
  activeFilter: string;       // 'all' | 'sast' | 'sca' | 'dast'
  onFilterChange: (filter: string) => void;
  onFindingClick: (findingId: string) => void;
}

const FILTERS = ['all', 'sast', 'sca', 'dast'] as const;

export function FindingsTable({
  findings,
  activeFilter,
  onFilterChange,
  onFindingClick,
}: FindingsTableProps) {
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = findings
    .filter((f) => activeFilter === 'all' || f.scan_type === activeFilter)
    .sort((a, b) => {
      const diff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      return sortDir === 'asc' ? diff : -diff;
    });

  const toggleSort = () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  return (
    <div className="w-full">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'All' : f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">
          {filtered.length} finding{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/60">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                <button
                  onClick={toggleSort}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  Severity
                  {sortDir === 'asc' ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Scanner</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Title</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No findings match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((f) => (
                <Fragment key={f.id}>
                  <tr
                    onClick={() => {
                      setExpandedId(expandedId === f.id ? null : f.id);
                      onFindingClick(f.id);
                    }}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs uppercase">{f.scan_type}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{f.scanner}</td>
                    <td className="px-4 py-3 text-gray-200 max-w-xs truncate" title={f.title}>
                      {f.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate max-w-[180px]" title={f.file_path}>
                      {f.file_path
                        ? `${f.file_path}${f.line_start ? `:${f.line_start}` : ''}`
                        : '—'}
                    </td>
                  </tr>
                  {/* Expandable detail row */}
                  {expandedId === f.id && (
                    <tr key={`${f.id}-detail`} className="bg-gray-900/40">
                      <td colSpan={5} className="px-6 py-4 space-y-2">
                        {f.description && (
                          <p className="text-sm text-gray-300">{f.description}</p>
                        )}
                        <div className="flex gap-4 text-xs text-gray-500">
                          {f.cwe_id && <span>CWE: {f.cwe_id}</span>}
                          {f.rule_id && <span>Rule: {f.rule_id}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
