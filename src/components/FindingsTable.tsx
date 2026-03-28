'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import type { ScanFinding, SeverityLevel, ScannerType, ScanCategory } from '../../packages/shared/types/finding';

const SEVERITY_ORDER: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_RANK: Record<SeverityLevel, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

type SortDir = 'asc' | 'desc';

interface Props {
  findings: ScanFinding[];
  onSelect: (f: ScanFinding) => void;
}

export function FindingsTable({ findings, onSelect }: Props): JSX.Element {
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [scannerFilter, setScannerFilter] = useState<ScannerType | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ScanCategory | 'all'>('all');

  const scanners = Array.from(new Set(findings.map((f) => f.scanner)));
  const types = Array.from(new Set(findings.map((f) => f.scan_type)));

  const filtered = findings
    .filter((f) => scannerFilter === 'all' || f.scanner === scannerFilter)
    .filter((f) => typeFilter === 'all' || f.scan_type === typeFilter)
    .sort((a, b) => {
      const diff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      return sortDir === 'asc' ? diff : -diff;
    });

  const toggleSort = () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  return (
    <div className="w-full">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Scanner filter */}
        <select
          value={scannerFilter}
          onChange={(e) => setScannerFilter(e.target.value as ScannerType | 'all')}
          className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All scanners</option>
          {scanners.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ScanCategory | 'all')}
          className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-gray-500">{filtered.length} finding{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900">
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
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Title</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Scanner</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No findings match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => onSelect(f)}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <SeverityBadge severity={f.severity} />
                  </td>
                  <td className="px-4 py-3 text-gray-200 max-w-xs truncate" title={f.title}>
                    {f.title}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{f.scanner}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs uppercase">{f.scan_type}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate max-w-[180px]" title={f.file_path}>
                    {f.file_path
                      ? `${f.file_path}${f.line_start ? `:${f.line_start}` : ''}`
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
