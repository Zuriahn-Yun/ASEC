'use client';

import { useEffect } from 'react';
import { insforge } from './insforge';

interface ScanRealtimeCallbacks {
  onStatusChange: (status: string, error?: string) => void;
  onFindingBatch: (count: number) => void;
  onFixGenerated: (findingId: string) => void;
}

/**
 * Subscribes to InsForge realtime events for a scan and removes listeners
 * cleanly on unmount so revisiting a scan does not duplicate callbacks.
 */
export function useScanRealtime(
  scanId: string,
  callbacks: ScanRealtimeCallbacks,
): void {
  const { onStatusChange, onFindingBatch, onFixGenerated } = callbacks;

  useEffect(() => {
    if (!scanId) return;

    const channel = `scan:${scanId}`;
    let active = true;

    const handleStatusChanged = (message: { payload?: { status?: string; error?: string } }) => {
      if (!active || !message.payload?.status) {
        return;
      }

      onStatusChange(message.payload.status, message.payload.error);
    };

    const handleFindingBatch = (message: { payload?: { count?: number } }) => {
      if (!active || typeof message.payload?.count !== 'number') {
        return;
      }

      onFindingBatch(message.payload.count);
    };

    const handleFixGenerated = (message: { payload?: { finding_id?: string } }) => {
      if (!active || !message.payload?.finding_id) {
        return;
      }

      onFixGenerated(message.payload.finding_id);
    };

    const setup = async () => {
      try {
        await insforge.realtime.connect();
        if (!active) return;

        const subscription = await insforge.realtime.subscribe(channel);
        if (!active || !subscription.ok) return;

        insforge.realtime.on('status_changed', handleStatusChanged);
        insforge.realtime.on('finding_batch', handleFindingBatch);
        insforge.realtime.on('fix_generated', handleFixGenerated);
      } catch {
        // Realtime is optional for the demo; the page polls while a scan runs.
      }
    };

    setup();

    return () => {
      active = false;
      insforge.realtime.off('status_changed', handleStatusChanged);
      insforge.realtime.off('finding_batch', handleFindingBatch);
      insforge.realtime.off('fix_generated', handleFixGenerated);
      insforge.realtime.unsubscribe(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);
}
