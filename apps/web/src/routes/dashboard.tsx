import { Link } from "react-router-dom";
import { Send, UserPlus, Users, BarChart3, ArrowRight } from "lucide-react";
import { Page } from "../components/Page.js";
import { useGuests } from "../hooks/useGuests.js";
import { api } from "../lib/api.js";
import { useQuery } from "@tanstack/react-query";

interface Campaign {
  id: string;
  title: string;
  createdAt: string;
  totalsQueued: number;
  totalsSeen: number;
  status: string;
}

export function DashboardPage() {
  const { data: guests } = useGuests("checked_in");
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api<Campaign[]>("/api/campaigns"),
  });
  const activeCount = guests?.length ?? 0;
  const lastCampaign = campaigns?.[0];

  return (
    <Page title="Dashboard" description="What would you like to do today?">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/send"
          className="card group relative flex items-center gap-4 p-6 hover:shadow-lift transition ring-2 ring-brand-500/0 hover:ring-brand-500/60"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold">Send message</div>
            <div className="text-sm text-slate-500">Start a new campaign</div>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 text-slate-400 group-hover:text-brand-600" />
        </Link>

        <Link to="/guests?checkin=1" className="card flex items-center gap-4 p-6 hover:shadow-lift transition">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold">Check in guest</div>
            <div className="text-sm text-slate-500">Under 10 seconds</div>
          </div>
        </Link>

        <Link to="/guests" className="card flex items-center gap-4 p-6 hover:shadow-lift transition">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold">Manage guests</div>
            <div className="text-sm text-slate-500">{activeCount} active</div>
          </div>
        </Link>

        <Link to="/reports" className="card flex items-center gap-4 p-6 hover:shadow-lift transition">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold">Reports</div>
            <div className="text-sm text-slate-500">Campaign results</div>
          </div>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-medium text-slate-500">Checked-in guests</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">{activeCount}</div>
          <p className="mt-2 text-sm text-slate-500">
            Across every language you speak.
          </p>
        </div>

        <div className="card p-6">
          <div className="text-sm font-medium text-slate-500">Last campaign</div>
          {lastCampaign ? (
            <div className="mt-1">
              <div className="text-lg font-semibold truncate">{lastCampaign.title}</div>
              <div className="mt-2 text-sm text-slate-500">
                {lastCampaign.totalsSeen} seen of {lastCampaign.totalsQueued} sent
              </div>
              <Link
                to={`/campaigns/${lastCampaign.id}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900"
              >
                View details <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-1 text-sm text-slate-400">
              No campaigns yet — start your first one.
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
