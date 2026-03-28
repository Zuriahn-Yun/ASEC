'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ScanFinding, SeverityLevel } from '../../packages/shared/types/finding';
import type { ScanSummary } from '../../packages/shared/types/fix';
import { SEVERITY_COLORS } from '../../packages/shared/constants';

interface SeverityChartProps {
  summary?: ScanSummary | null;
  findings?: ScanFinding[];
}

type SeverityKey = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_FIELDS: { key: SeverityKey; label: string; field: keyof ScanSummary }[] = [
  { key: 'critical', label: 'Critical', field: 'critical_count' },
  { key: 'high',     label: 'High',     field: 'high_count' },
  { key: 'medium',   label: 'Medium',   field: 'medium_count' },
  { key: 'low',      label: 'Low',      field: 'low_count' },
  { key: 'info',     label: 'Info',     field: 'info_count' },
];

export function SeverityChart({ summary, findings }: SeverityChartProps) {
  let data: { key: SeverityKey; name: string; value: number }[];

  if (summary) {
    data = SEVERITY_FIELDS
      .map(({ key, label, field }) => ({
        key,
        name: label,
        value: (summary[field] as number) ?? 0,
      }))
      .filter((d) => d.value > 0);
  } else {
    const counts: Record<SeverityKey, number> = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0,
    };
    for (const f of findings ?? []) {
      const sev = f.severity as SeverityKey;
      if (sev in counts) counts[sev]++;
    }
    data = SEVERITY_FIELDS
      .filter(({ key }) => counts[key] > 0)
      .map(({ key, label }) => ({ key, name: label, value: counts[key] }));
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No findings to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f9fafb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
