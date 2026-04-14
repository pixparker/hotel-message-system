import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { applyBrandColor } from "../lib/brand.js";
import { useAuth } from "../state/auth.js";

interface SettingsShape {
  brandPrimaryColor?: string | null;
}

/**
 * Fetches `/api/settings` and pushes `brandPrimaryColor` into the CSS
 * variables driving the theme. Only runs while authenticated so
 * login stays on the persisted color.
 */
export function BrandSync() {
  const user = useAuth((s) => s.user);
  const { data } = useQuery({
    queryKey: ["settings-brand"],
    queryFn: () => api<SettingsShape>("/api/settings"),
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.brandPrimaryColor) {
      applyBrandColor(data.brandPrimaryColor);
    }
  }, [data?.brandPrimaryColor]);

  return null;
}
