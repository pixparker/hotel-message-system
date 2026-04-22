import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import type { AudienceKind } from "./useAudiences.js";

export interface DashboardStats {
  activeContacts: {
    total: number;
    byLanguage: Array<{ language: string; count: number }>;
  };
  checkedInGuests: {
    total: number;
    byLanguage: Array<{ language: string; count: number }>;
  };
  byAudience: Array<{
    id: string;
    name: string;
    kind: AudienceKind;
    isSystem: boolean;
    memberCount: number;
  }>;
  campaigns: {
    total: number;
    last7dCount: number;
    last7dSent: number;
    last7dDelivered: number;
    last7dSeen: number;
    last7dFailed: number;
    readRatePercent: number;
    avgReadMs: number;
  };
  recentCampaigns: Array<{
    id: string;
    title: string;
    createdAt: string;
    status: string;
    queued: number;
    sent: number;
    delivered: number;
    seen: number;
  }>;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api<DashboardStats>("/api/stats/dashboard"),
    refetchInterval: 5000,
  });
}
