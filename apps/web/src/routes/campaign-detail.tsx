import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Page } from "../components/Page.js";
import { formatPhoneDisplay } from "@hms/shared";

interface Message {
  id: string;
  phoneE164: string;
  language: string;
  renderedBody: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  error: string | null;
}
interface CampaignDetail {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  totalsQueued: number;
  totalsSent: number;
  totalsDelivered: number;
  totalsSeen: number;
  totalsFailed: number;
  messages: Message[];
}

const statusTone: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  delivered: "bg-brand-100 text-brand-700",
  read: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};

export function CampaignDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api<CampaignDetail>(`/api/campaigns/${id}`),
  });

  if (isLoading || !data) {
    return (
      <Page title="Campaign">
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      </Page>
    );
  }

  return (
    <Page
      title={data.title}
      description={new Date(data.createdAt).toLocaleString()}
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Recipients" value={data.totalsQueued} />
        <Stat label="Sent" value={data.totalsSent} />
        <Stat label="Delivered" value={data.totalsDelivered} />
        <Stat label="Read" value={data.totalsSeen} />
        <Stat label="Failed" value={data.totalsFailed} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">Read</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.messages.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 tabular-nums">
                  {formatPhoneDisplay(m.phoneE164)}
                </td>
                <td className="px-4 py-3 uppercase text-slate-500">{m.language}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${statusTone[m.status] ?? ""}`}>
                    {m.status}
                  </span>
                  {m.error && (
                    <div className="text-xs text-rose-600 mt-1">{m.error}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {m.sentAt ? new Date(m.sentAt).toLocaleTimeString() : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {m.readAt ? new Date(m.readAt).toLocaleTimeString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
