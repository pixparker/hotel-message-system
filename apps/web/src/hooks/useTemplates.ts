import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export interface Template {
  id: string;
  name: string;
  description: string | null;
  bodies: Array<{ language: string; body: string }>;
}

export function useTemplates() {
  return useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/api/templates") });
}
