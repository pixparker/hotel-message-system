import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export interface Guest {
  id: string;
  name: string;
  phoneE164: string;
  language: string;
  roomNumber: string | null;
  status: "checked_in" | "checked_out";
  checkedInAt: string;
  checkedOutAt: string | null;
}

export function useGuests(status?: "checked_in" | "checked_out") {
  return useQuery({
    queryKey: ["guests", status ?? "all"],
    queryFn: () =>
      api<Guest[]>(`/api/guests${status ? `?status=${status}` : ""}`),
  });
}

export function useCheckInGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      phone: string;
      language: string;
      roomNumber?: string;
    }) => api<Guest>("/api/guests", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guests"] }),
  });
}

export function useCheckOutGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Guest>(`/api/guests/${id}/checkout`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guests"] }),
  });
}

export function useUndoCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Guest>(`/api/guests/${id}/checkin`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guests"] }),
  });
}
