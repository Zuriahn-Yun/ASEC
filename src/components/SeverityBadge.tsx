import type { SeverityLevel } from '../../packages/shared/types/finding';

const COLORS: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-[#dc2626]/10', text: 'text-[#dc2626]', border: 'border-[#dc2626]/30' },
  high:     { bg: 'bg-[#ea580c]/10', text: 'text-[#ea580c]', border: 'border-[#ea580c]/30' },
  medium:   { bg: 'bg-[#ca8a04]/10', text: 'text-[#ca8a04]', border: 'border-[#ca8a04]/30' },
  low:      { bg: 'bg-[#2563eb]/10', text: 'text-[#2563eb]', border: 'border-[#2563eb]/30' },
  info:     { bg: 'bg-[#6b7280]/10', text: 'text-[#6b7280]', border: 'border-[#6b7280]/30' },
};

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const c = COLORS[severity] ?? COLORS.info;
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-semibold uppercase tracking-wide ${c.bg} ${c.text} ${c.border}`}
    >
      {severity}
    </span>
  );
}
