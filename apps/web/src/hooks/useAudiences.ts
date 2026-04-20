import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export type AudienceKind = "hotel_guests" | "vip" | "friends" | "custom";

export interface Audience {
  id: string;
  name: string;
  kind: AudienceKind;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  memberCount: number;
}

export interface AudienceCreateInput {
  name: string;
  kind?: AudienceKind;
  description?: string;
}

export interface AudienceMember {
  id: string;
  name: string;
  phoneE164: string;
  language: string;
  source: "manual" | "hotel" | "csv" | "future";
  isActive: boolean;
  roomNumber: string | null;
  createdAt: string;
}

export function useAudiences() {
  return useQuery({
    queryKey: ["audiences"],
    queryFn: () => api<Audience[]>("/api/audiences"),
  });
}

export function useAudience(id: string | undefined) {
  return useQuery({
    queryKey: ["audience", id],
    queryFn: async () => {
      const list = await api<Audience[]>("/api/audiences");
      return list.find((a) => a.id === id) ?? null;
    },
    enabled: !!id,
  });
}

export function useAudienceMembers(id: string | undefined) {
  return useQuery({
    queryKey: ["audience-members", id],
    queryFn: () => api<AudienceMember[]>(`/api/audiences/${id}/contacts`),
    enabled: !!id,
  });
}

export function useCreateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AudienceCreateInput) =>
      api<Audience>("/api/audiences", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audiences"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<AudienceCreateInput>) =>
      api<Audience>(`/api/audiences/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audiences"] });
      qc.invalidateQueries({ queryKey: ["audience"] });
    },
  });
}

export function useDeleteAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/audiences/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audiences"] });
    },
  });
}

export function useAddToAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, contactIds }: { audienceId: string; contactIds: string[] }) =>
      api(`/api/audiences/${audienceId}/contacts`, {
        method: "POST",
        body: JSON.stringify({ contactIds }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["audiences"] });
      qc.invalidateQueries({ queryKey: ["audience-members", variables.audienceId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useRemoveFromAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, contactIds }: { audienceId: string; contactIds: string[] }) =>
      api(`/api/audiences/${audienceId}/contacts`, {
        method: "DELETE",
        body: JSON.stringify({ contactIds }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["audiences"] });
      qc.invalidateQueries({ queryKey: ["audience-members", variables.audienceId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
