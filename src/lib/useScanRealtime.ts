'use client';

import { useEffect } from 'react';
import { insforge } from './insforge';

interface ScanRealtimeCallbacks {
  onStatusChange: (status: string, error?: string) => void;
  onFindingBatch: (count: number) => void;
  onFixGenerated: (findingId: string) => void;
}

/**
 * Subscribes to InsForge Realtime events for a scan and calls the provided
 * callbacks as events arrive. Cleans up the subscription on unmount.
 *
 * Channel: `scan:<scanId>`
 * Events published by packages/scanner/src/reporter.ts:
 *   - 'status_changed' → { scan_id, status, error?, timestamp }
 *   - 'finding_batch'  → { scan_id, count, timestamp }
 *   - 'fix_generated'  → { scan_id, finding_id, confidence, timestamp }
 */
export function useScanRealtime(
  scanId: string,
  callbacks: ScanRealtimeCallbacks,
): void {
  // Stable refs so the effect doesn't re-run when callbacks change identity
  const { onStatusChange, onFindingBatch, onFixGenerated } = callbacks;

  useEffect(() => {
    if (!scanId) return;

    const channel = `scan:${scanId}`;
    let active = true;

    const setup = async () => {
      try {
        await insforge.realtime.connect();
        if (!active) return;

        await insforge.realtime.subscribe(channel);
        if (!active) return;

        insforge.realtime.on('status_changed', (msg) => {
          if (!active) return;
          const p = (msg as { payload?: { status?: string; error?: string } }).payload;
          if (p?.status) onStatusChange(p.status, p.error);
        });

        insforge.realtime.on('finding_batch', (msg) => {
          if (!active) return;
          const p = (msg as { payload?: { count?: number } }).payload;
          if (typeof p?.count === 'number') onFindingBatch(p.count);
        });

        insforge.realtime.on('fix_generated', (msg) => {
          if (!active) return;
          const p = (msg as { payload?: { finding_id?: string } }).payload;
          if (p?.finding_id) onFixGenerated(p.finding_id);
        });
      } catch {
        // Connection failure is non-fatal — caller shows stale data
      }
    };

    setup();

    return () => {
      active = false;
      insforge.realtime.unsubscribe(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);
}
