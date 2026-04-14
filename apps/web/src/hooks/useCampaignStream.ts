import { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/auth.js";

export interface CampaignTotals {
  queued: number;
  sent: number;
  delivered: number;
  seen: number;
  failed: number;
}

export interface CampaignStreamState {
  totals: CampaignTotals;
  status: "draft" | "sending" | "done" | "cancelled";
  done: boolean;
}

/**
 * SSE browsers can't send Authorization headers, so we fall back to polling
 * the snapshot endpoint every 1.5s until the campaign is terminal. This is
 * deliberate — M1 uses a single channel the worker pushes to, and the poll
 * is cheap. Swap for a token-query-param SSE in M2 if needed.
 */
export function useCampaignStream(campaignId: string): CampaignStreamState {
  const [state, setState] = useState<CampaignStreamState>({
    totals: { queued: 0, sent: 0, delivered: 0, seen: 0, failed: 0 },
    status: "sending",
    done: false,
  });
  const token = useAuth((s) => s.accessToken);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    async function tick() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`, {
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        setState({
          totals: {
            queued: data.totalsQueued,
            sent: data.totalsSent,
            delivered: data.totalsDelivered,
            seen: data.totalsSeen,
            failed: data.totalsFailed,
          },
          status: data.status,
          done: data.status === "done" || data.status === "cancelled",
        });
        if (data.status === "done" || data.status === "cancelled") return;
      } catch {
        // swallow — retry next tick
      }
      if (!stopped.current) setTimeout(tick, 1500);
    }
    tick();
    return () => {
      stopped.current = true;
    };
  }, [campaignId, token]);

  return state;
}
