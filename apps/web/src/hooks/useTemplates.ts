import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export interface Template {
  id: string;
  name: string;
  description: string | null;
  bodies: Array<{ language: string; body: string }>;
}

export interface TemplateInput {
  name: string;
  description?: string;
  bodies: Array<{ language: string; body: string }>;
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => api<Template[]>("/api/templates"),
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: () => api<Template>(`/api/templates/${id}`),
    enabled: !!id,
  });
}

export function useSaveTemplate(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateInput) =>
      api<Template>(id ? `/api/templates/${id}` : "/api/templates", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      if (id) qc.invalidateQueries({ queryKey: ["template", id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
