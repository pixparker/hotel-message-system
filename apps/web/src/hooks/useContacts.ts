import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export type ContactSource = "manual" | "hotel" | "csv" | "future";

export interface Contact {
  id: string;
  name: string;
  phoneE164: string;
  language: string;
  source: ContactSource;
  isActive: boolean;
  roomNumber: string | null;
  status: "checked_in" | "checked_out" | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
  audienceIds: string[];
  tagIds: string[];
}

export interface ContactFilters {
  status?: "checked_in" | "checked_out";
  source?: ContactSource;
  audienceId?: string;
  isActive?: boolean;
  q?: string;
}

function buildQuery(filters: ContactFilters | undefined): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.audienceId) params.set("audienceId", filters.audienceId);
  if (filters.isActive !== undefined)
    params.set("isActive", String(filters.isActive));
  if (filters.q) params.set("q", filters.q);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useContacts(filters?: ContactFilters) {
  return useQuery({
    queryKey: ["contacts", filters ?? null],
    queryFn: () => api<Contact[]>(`/api/contacts${buildQuery(filters)}`),
  });
}

export interface ContactCreateInput {
  name: string;
  phone: string;
  language: string;
  source?: ContactSource;
  isActive?: boolean;
  roomNumber?: string;
  audienceIds?: string[];
  tagIds?: string[];
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ContactCreateInput) =>
      api<Contact>("/api/contacts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["audiences"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export interface ContactUpdateInput extends Partial<ContactCreateInput> {
  id: string;
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: ContactUpdateInput) =>
      api<Contact>(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["audiences"] });
    },
  });
}

/**
 * Outcome of the Check-In module's auto-message attempt, returned by the
 * checkin/checkout endpoints so the UI can surface a follow-up toast.
 */
export type AutoMessageResult =
  | { triggered: true; campaignId: string; templateName: string }
  | {
      triggered: false;
      reason:
        | "module_disabled"
        | "auto_disabled"
        | "no_template"
        | "template_missing"
        | "no_phone"
        | "send_failed";
    };

export type ContactWithAutoMessage = Contact & { autoMessage?: AutoMessageResult };

export function useCheckOutContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<ContactWithAutoMessage>(`/api/contacts/${id}/checkout`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUndoCheckOutContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<ContactWithAutoMessage>(`/api/contacts/${id}/checkin`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

/**
 * "Delete" a contact by flipping `isActive: false`. Preserves the row (and
 * its historical messages + report data) while hiding the contact from the
 * default list view.
 */
export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Contact>(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["audiences"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useRestoreContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Contact>(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["audiences"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
