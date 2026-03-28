'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ScanFinding, SeverityLevel } from '../../packages/shared/types/finding';

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#ca8a04',
  low:      '#2563eb',
  info:     '#6b7280',
};

const ORDER: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

export function SeverityChart({ findings }: { findings: ScanFinding[] }) {
  const counts = ORDER.reduce<Record<SeverityLevel, number>>(
    (acc, sev) => ({ ...acc, [sev]: 0 }),
    {} as Record<SeverityLevel, number>,
  );

  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }

  const data = ORDER
    .filter((sev) => counts[sev] > 0)
    .map((sev) => ({ name: sev.charAt(0).toUpperCase() + sev.slice(1), value: counts[sev], sev }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No findings yet
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
            <Cell key={entry.sev} fill={SEVERITY_COLORS[entry.sev]} />
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
