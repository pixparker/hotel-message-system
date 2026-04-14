import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Page } from "../components/Page.js";
import { EmptyState } from "../components/EmptyState.js";

interface Campaign {
  id: string;
  title: string;
  createdAt: string;
  totalsQueued: number;
  totalsSent: number;
  totalsDelivered: number;
  totalsSeen: number;
  totalsFailed: number;
  status: string;
}

export function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api<Campaign[]>("/api/campaigns"),
  });

  return (
    <Page title="Reports" description="Past campaigns and their results.">
      {isLoading ? (
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No campaigns yet"
          description="Reports appear here after you send your first message."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Sent</th>
                <th className="px-4 py-3 text-right">Delivered</th>
                <th className="px-4 py-3 text-right">Seen</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/campaigns/${c.id}`} className="hover:text-brand-700">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.totalsSent}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.totalsDelivered}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.totalsSeen}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        c.status === "done"
                          ? "badge bg-emerald-100 text-emerald-700"
                          : c.status === "sending"
                            ? "badge bg-amber-100 text-amber-700"
                            : "badge bg-slate-100 text-slate-600"
                      }
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
