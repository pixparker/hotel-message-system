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
  dailySent: Array<{ day: string; count: number; campaigns: number }>;
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
    origin: CampaignOrigin;
    createdAt: string;
    status: string;
    queued: number;
    sent: number;
    delivered: number;
    seen: number;
    failed: number;
  }>;
}

export type CampaignOrigin = "manual" | "auto_check_in" | "auto_check_out";

export function useReportsStats() {
  // Pass the browser's IANA timezone so server-side day buckets line up with
  // the user's local calendar — otherwise midnight-local sends in positive
  // UTC offsets get grouped into the previous UTC day on the chart.
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  return useQuery({
    queryKey: ["reports-stats", tz],
    queryFn: () =>
      api<ReportsStats>(`/api/stats/reports?tz=${encodeURIComponent(tz)}`),
  });
}
