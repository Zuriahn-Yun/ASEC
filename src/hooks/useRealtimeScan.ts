'use client';

import { useEffect, useRef, useState } from 'react';
import { insforge } from '@/lib/insforge';
import type { ScanFinding, ScanStatus } from '../../packages/shared/types/index';

const CHANNEL = (scanId: string) => `scan:${scanId}`;

export function useRealtimeScan(scanId: string | null): {
  status: ScanStatus | string;
  findings: ScanFinding[];
  error: string | null;
} {
  const [status, setStatus] = useState<ScanStatus | string>('queued');
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref so the cleanup closure captures the latest scanId
  const scanIdRef = useRef(scanId);
  scanIdRef.current = scanId;

  useEffect(() => {
    if (!scanId) return;

    let cancelled = false;

    // -----------------------------------------------------------------------
    // Initial load — fetch current status + findings from DB
    // -----------------------------------------------------------------------
    const load = async () => {
      const [{ data: job }, { data: rows }] = await Promise.all([
        insforge.database.from('scan_jobs').select('status').eq('id', scanId).single(),
        insforge.database
          .from('findings')
          .select('*')
          .eq('scan_id', scanId)
          .order('severity', { ascending: true }),
      ]);

      if (cancelled) return;

      if (job) setStatus((job as { status: ScanStatus }).status);
      if (rows) setFindings(rows as ScanFinding[]);
    };

    load().catch((err: unknown) => {
      if (!cancelled) setError(String(err));
    });

    // -----------------------------------------------------------------------
    // Realtime subscription
    // -----------------------------------------------------------------------
    const channel = CHANNEL(scanId);

    const connect = async () => {
      try {
        await insforge.realtime.connect();
        if (cancelled) return;

        await insforge.realtime.subscribe(channel);
        if (cancelled) return;

        // Status updates published by the backend scanner
        insforge.realtime.on('status', (msg) => {
          const payload = (msg as { payload?: { status?: ScanStatus; error?: string } }).payload;
          if (!payload) return;
          if (payload.status) setStatus(payload.status);
          if (payload.error) setError(payload.error);
        });

        // Batch of new findings streamed during scan
        insforge.realtime.on('finding_batch', (msg) => {
          const payload = (msg as { payload?: { findings?: ScanFinding[] } }).payload;
          if (payload?.findings) {
            setFindings((prev) => [...prev, ...payload.findings!]);
          }
        });
      } catch (err: unknown) {
        if (!cancelled) setError(String(err));
      }
    };

    connect();

    return () => {
      cancelled = true;
      insforge.realtime.unsubscribe(channel);
    };
  }, [scanId]);

  return { status, findings, error };
}
