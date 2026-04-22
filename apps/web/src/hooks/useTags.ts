import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export interface Tag {
  id: string;
  label: string;
  color: string | null;
  createdAt: string;
  usageCount: number;
}

export interface TagCreateInput {
  label: string;
  color?: string;
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api<Tag[]>("/api/tags"),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TagCreateInput) =>
      api<Tag>("/api/tags", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<TagCreateInput>) =>
      api<Tag>(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
