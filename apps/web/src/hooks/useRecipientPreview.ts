import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export interface RecipientPreview {
  total: number;
  byLanguage: Array<{ language: string; count: number }>;
  sample: Array<{ id: string; name: string; phoneE164: string }>;
}

export function useRecipientPreview(audienceIds: string[]) {
  const ids = [...audienceIds].sort().join(",");
  return useQuery({
    queryKey: ["recipient-preview", ids],
    queryFn: () =>
      ids
        ? api<RecipientPreview>(
            `/api/campaigns/recipient-preview?audienceIds=${encodeURIComponent(ids)}`,
          )
        : Promise.resolve({
            total: 0,
            byLanguage: [],
            sample: [],
          } satisfies RecipientPreview),
    enabled: true,
  });
}
