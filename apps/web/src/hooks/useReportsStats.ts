import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export interface ReportsStats {
  totals: {
    campaigns: number;
    queued: number;
    sent: number;
    delivered: number;
    seen: number;
    failed: number;
    uniqueRecipients: number;
    deliveryRate: number;
    readRate: number;
  };
  readTiming: {
    avgMs: number;
    medianMs: number;
  };
  dailySent: Array<{ day: string; count: number }>;
  readBuckets: Partial<Record<"lt5m" | "lt30m" | "lt1h" | "lt3h" | "gt3h", number>>;
  topCampaign: {
    id: string;
    title: string;
    createdAt: string;
    queued: number;
    seen: number;
  } | null;
  campaigns: Array<{
    id: string;
    title: string;
    createdAt: string;
    status: string;
    queued: number;
    sent: number;
    delivered: number;
    seen: number;
    failed: number;
  }>;
}

export function useReportsStats() {
  return useQuery({
    queryKey: ["reports-stats"],
    queryFn: () => api<ReportsStats>("/api/stats/reports"),
  });
}
