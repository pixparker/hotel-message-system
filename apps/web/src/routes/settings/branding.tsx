import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { BrandingCard } from "./_components/BrandingCard.js";

interface Settings {
  brandPrimaryColor: string | null;
}

export function BrandingSettingsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/api/settings"),
  });

  return (
    <BrandingCard
      currentColor={data?.brandPrimaryColor ?? null}
      onSaved={() => {
        qc.invalidateQueries({ queryKey: ["settings"] });
        qc.invalidateQueries({ queryKey: ["settings-brand"] });
      }}
    />
  );
}
