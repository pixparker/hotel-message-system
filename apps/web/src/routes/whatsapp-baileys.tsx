import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Phone,
  ShieldAlert,
  Unplug,
  RefreshCw,
} from "lucide-react";
import { Page } from "../components/Page.js";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../state/auth.js";
import { useToast } from "../components/toast.js";

type Status = "none" | "pending" | "connected" | "logged_out" | "failed";

interface BaileysStatus {
  status: Status;
  phoneE164?: string | null;
  connectedAt?: string | null;
  throttleMode?: "careful" | "balanced" | "custom";
  customRatePerMin?: number | null;
  dailyCap?: number;
  coldPolicy?: "warn" | "block" | "allow";
  acknowledgedAt?: string | null;
  bannedSuspectedAt?: string | null;
}

/**
 * Baileys (WhatsApp Web / unofficial) connect + safety configuration page.
 *
 * Three visual states:
 *   - Not connected → 4-checkbox acknowledgment gate → QR scan flow
 *   - Connected     → phone badge, safety panel, disconnect
 *   - Session lost  → red banner, reconnect CTA
 */
export function WhatsAppBaileysPage() {
  const qc = useQueryClient();
  const { data: status, refetch } = useQuery({
    queryKey: ["baileys-status"],
    queryFn: () => api<BaileysStatus>("/api/settings/whatsapp/baileys/status"),
    refetchOnWindowFocus: false,
  });

  const s = status?.status ?? "none";

  return (
    <Page
      title="Connect WhatsApp (Web / Baileys)"
      description="Scan a QR code with your business phone to send messages via an unofficial WhatsApp Web connection. Fast to set up — no Meta Business verification required."
    >
      <div className="max-w-2xl mx-auto space-y-5">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>

        <UnofficialWarningCard />

        {status?.bannedSuspectedAt && s !== "connected" && (
          <div className="card border-rose-200 bg-rose-50 p-5 space-y-2">
            <div className="flex items-center gap-2 text-rose-700 font-semibold">
              <ShieldAlert className="h-5 w-5" />
              Your WhatsApp session was terminated
            </div>
            <p className="text-sm text-rose-700">
              WhatsApp logged out this device. This often means your number has
              been flagged or banned. You can try reconnecting, but if the new
              QR fails to pair, the number is likely banned. Use a{" "}
              <strong>dedicated business number</strong> next time.
            </p>
          </div>
        )}

        {s === "connected" ? (
          <ConnectedPanel status={status!} onRefetch={refetch} />
        ) : (
          <PairFlow onPaired={() => qc.invalidateQueries({ queryKey: ["baileys-status"] })} />
        )}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------

function UnofficialWarningCard() {
  return (
    <div className="card border-amber-200 bg-amber-50 p-5 space-y-2">
      <div className="flex items-center gap-2 text-amber-800 font-semibold">
        <AlertTriangle className="h-5 w-5" />
        Unofficial connection — at your own risk
      </div>
      <ul className="text-sm text-amber-900 space-y-1 list-disc pl-5">
        <li>Uses WhatsApp Web, which is <strong>not an official Meta API</strong>. Your number can be banned at any time.</li>
        <li>Use a <strong>dedicated business number</strong>, never your personal WhatsApp.</li>
        <li>Don't send cold outreach. Sending to people who haven't messaged you first is the #1 reason numbers get banned.</li>
        <li>For reliable, high-volume sending, switch to Meta Cloud API.</li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

const ACK_ITEMS = [
  { key: "acknowledgeDedicatedNumber" as const, label: "This is a dedicated business number, not my personal WhatsApp." },
  { key: "acknowledgeBanRisk" as const, label: "I understand Meta may ban this number at any time — this is unofficial." },
  { key: "acknowledgeNoColdOutreach" as const, label: "I will not send cold outreach to people who haven't messaged me first." },
  { key: "acknowledgeAcceptRisk" as const, label: "I accept the risk." },
];

function PairFlow({ onPaired }: { onPaired: () => void }) {
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("idle");
  const { push } = useToast();
  const allChecked = ACK_ITEMS.every((a) => acks[a.key]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      await api("/api/settings/whatsapp/baileys/connect", {
        method: "POST",
        body: JSON.stringify(acks),
      });
      setPairing(true);
      setStage("starting");
    } catch (err) {
      const detail =
        err instanceof ApiError && (err.body as { detail?: string })?.detail
          ? (err.body as { detail?: string }).detail
          : undefined;
      push({
        variant: "error",
        title: "Couldn't start pairing",
        description: detail ?? "Please try again.",
      });
    } finally {
      setStarting(false);
    }
  }, [acks, push]);

  // Subscribe to SSE updates once pairing has started.
  useEventStream({
    enabled: pairing,
    url: "/api/settings/whatsapp/baileys/events",
    onEvent: async (e) => {
      if (e.type === "qr") {
        setQr(e.qr);
        setStage("qr");
      } else if (e.type === "connecting") {
        setStage("connecting");
      } else if (e.type === "connected") {
        setStage("connected");
        setPairing(false);
        push({
          variant: "success",
          title: "Connected",
          description: `Paired with ${e.phoneE164 ?? "your phone"}.`,
        });
        onPaired();
      } else if (e.type === "logged_out") {
        setStage("logged_out");
        setPairing(false);
      } else if (e.type === "failed") {
        setStage("failed");
        setPairing(false);
        push({
          variant: "error",
          title: "Pairing failed",
          description: e.reason ?? "Try again.",
        });
      }
    },
  });

  // Render the QR string as an image whenever it changes.
  useEffect(() => {
    if (!qr) {
      setQrImage(null);
      return;
    }
    QRCode.toDataURL(qr, { width: 260, margin: 1 })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [qr]);

  if (pairing || qr) {
    return (
      <div className="card p-6 space-y-5">
        <h2 className="text-base font-semibold">Scan the QR code</h2>
        <ol className="text-sm text-slate-600 space-y-1 list-decimal pl-5">
          <li>Open WhatsApp on your phone.</li>
          <li>Tap Menu (⋮) → <strong>Linked devices</strong> → <strong>Link a device</strong>.</li>
          <li>Point your phone at this screen.</li>
        </ol>

        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 min-h-[320px]">
          {qrImage ? (
            <img src={qrImage} alt="WhatsApp pairing QR" className="h-[260px] w-[260px]" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
              <Loader2 className="h-8 w-8 animate-spin" />
              {stage === "connecting" ? "Connecting to WhatsApp…" : "Generating QR…"}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 text-center">
          {stage === "qr" && "QR codes refresh automatically. Don't share this screen."}
          {stage === "connecting" && "Connecting to WhatsApp servers…"}
          {stage === "failed" && "Pairing failed. Refresh and try again."}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold">Acknowledgments</h2>
        <p className="mt-1 text-xs text-slate-500">
          Tick all four to continue. These are recorded for your account's
          audit log.
        </p>
      </div>
      <div className="space-y-3">
        {ACK_ITEMS.map((item) => (
          <label key={item.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={!!acks[item.key]}
              onChange={(e) =>
                setAcks((prev) => ({ ...prev, [item.key]: e.target.checked }))
              }
            />
            <span className="text-sm text-slate-800">{item.label}</span>
          </label>
        ))}
      </div>
      <button
        className="btn-primary w-full"
        disabled={!allChecked || starting}
        onClick={start}
      >
        {starting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Starting…
          </>
        ) : (
          "Continue to QR pairing"
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ConnectedPanel({
  status,
  onRefetch,
}: {
  status: BaileysStatus;
  onRefetch: () => void;
}) {
  const qc = useQueryClient();
  const { push } = useToast();

  const disconnect = useMutation({
    mutationFn: () =>
      api("/api/settings/whatsapp/baileys/disconnect", { method: "POST" }),
    onSuccess: () => {
      push({ variant: "success", title: "Disconnected" });
      qc.invalidateQueries({ queryKey: ["baileys-status"] });
    },
    onError: () => {
      push({ variant: "error", title: "Couldn't disconnect" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="card p-5 flex items-start gap-4">
        <div className="rounded-lg bg-green-100 p-2">
          <CheckCircle2 className="h-6 w-6 text-green-700" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">Connected</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <Phone className="h-3.5 w-3.5" />
            <span className="font-mono">{status.phoneE164 ?? "—"}</span>
          </div>
          {status.connectedAt && (
            <div className="mt-1 text-xs text-slate-500">
              Paired {new Date(status.connectedAt).toLocaleString()}
            </div>
          )}
        </div>
        <button
          className="btn-secondary text-rose-700"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
        >
          {disconnect.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unplug className="h-4 w-4" />
          )}
          Disconnect
        </button>
      </div>

      <SafetyPanel status={status} onSaved={onRefetch} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SafetyPanel({
  status,
  onSaved,
}: {
  status: BaileysStatus;
  onSaved: () => void;
}) {
  const [throttleMode, setThrottleMode] = useState(status.throttleMode ?? "careful");
  const [customRate, setCustomRate] = useState(status.customRatePerMin ?? 20);
  const [dailyCap, setDailyCap] = useState(status.dailyCap ?? 500);
  const [coldPolicy, setColdPolicy] = useState(status.coldPolicy ?? "warn");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    setThrottleMode(status.throttleMode ?? "careful");
    setCustomRate(status.customRatePerMin ?? 20);
    setDailyCap(status.dailyCap ?? 500);
    setColdPolicy(status.coldPolicy ?? "warn");
  }, [status]);

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings/whatsapp/baileys/safety", {
        method: "PATCH",
        body: JSON.stringify({
          throttleMode,
          customRatePerMin: throttleMode === "custom" ? customRate : null,
          dailyCap,
          coldPolicy,
        }),
      });
      push({ variant: "success", title: "Safety settings saved" });
      onSaved();
    } catch {
      push({ variant: "error", title: "Couldn't save safety settings" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" /> Ban-risk safety
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          These knobs shape how aggressively we send. Lower = safer, but slower.
        </p>
      </div>

      <div>
        <label className="label">Send rate</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <ThrottleOption
            active={throttleMode === "careful"}
            onClick={() => setThrottleMode("careful")}
            title="Careful"
            rate="15/min"
            hint="Strongest protection"
          />
          <ThrottleOption
            active={throttleMode === "balanced"}
            onClick={() => setThrottleMode("balanced")}
            title="Balanced"
            rate="30/min"
            hint="After 7+ days"
          />
          <ThrottleOption
            active={throttleMode === "custom"}
            onClick={() => setThrottleMode("custom")}
            title="Custom"
            rate={`${customRate}/min`}
            hint="You pick the rate"
          />
        </div>
        {throttleMode === "custom" && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={60}
              value={customRate}
              onChange={(e) => setCustomRate(parseInt(e.target.value, 10))}
              className="flex-1 accent-brand-600"
            />
            <span className="w-24 text-sm font-mono tabular-nums text-right">
              {customRate} / min
            </span>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          New sessions (less than 24 hours old) are pinned to the Careful rate
          regardless of your preset — to avoid a warm-up that trips WhatsApp's
          abuse detection.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="dailyCap">
          Daily cap
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="dailyCap"
            type="range"
            min={50}
            max={1000}
            step={50}
            value={dailyCap}
            onChange={(e) => setDailyCap(parseInt(e.target.value, 10))}
            className="flex-1 accent-brand-600"
          />
          <span className="w-28 text-sm font-mono tabular-nums text-right">
            {dailyCap} / day
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Sends beyond this total in a 24h window are deferred to the next day.
        </p>
      </div>

      <div>
        <label className="label">Cold recipients (never messaged you)</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <ColdOption
            active={coldPolicy === "warn"}
            onClick={() => setColdPolicy("warn")}
            title="Warn"
            hint="Show a risk badge; allow send"
          />
          <ColdOption
            active={coldPolicy === "block"}
            onClick={() => setColdPolicy("block")}
            title="Block"
            hint="Disable send when cold count > 0"
          />
          <ColdOption
            active={coldPolicy === "allow"}
            onClick={() => setColdPolicy("allow")}
            title="Allow"
            hint="No warning (highest risk)"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Save safety settings
        </button>
      </div>
    </div>
  );
}

function ThrottleOption(props: {
  active: boolean;
  onClick: () => void;
  title: string;
  rate: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        "rounded-lg border p-3 text-left transition " +
        (props.active
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
          : "border-slate-200 hover:border-slate-300 bg-white")
      }
    >
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-0.5 text-xs text-brand-700 font-mono">{props.rate}</div>
      <div className="mt-1 text-xs text-slate-500">{props.hint}</div>
    </button>
  );
}

function ColdOption(props: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        "rounded-lg border p-3 text-left transition " +
        (props.active
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
          : "border-slate-200 hover:border-slate-300 bg-white")
      }
    >
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-1 text-xs text-slate-500">{props.hint}</div>
    </button>
  );
}

// ---------------------------------------------------------------------------

type PairingStreamEvent =
  | { type: "snapshot"; status: Status; phoneE164: string | null }
  | { type: "connecting" }
  | { type: "qr"; qr: string; expiresInSec: number }
  | { type: "connected"; phoneE164: string }
  | { type: "logged_out" }
  | { type: "failed"; reason: string };

/**
 * Subscribe to our SSE endpoint. Native EventSource doesn't support custom
 * headers, so we proxy the bearer token in the URL query. The API accepts
 * either for this endpoint.
 */
function useEventStream({
  enabled,
  url,
  onEvent,
}: {
  enabled: boolean;
  url: string;
  onEvent: (e: PairingStreamEvent) => void | Promise<void>;
}) {
  const token = useAuth((s) => s.accessToken);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    // Fetch-based streaming so we can send the Authorization header, which
    // EventSource does not support natively.
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, {
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // SSE frames are separated by a blank line.
          let sepIndex = buf.indexOf("\n\n");
          while (sepIndex >= 0) {
            const frame = buf.slice(0, sepIndex);
            buf = buf.slice(sepIndex + 2);
            sepIndex = buf.indexOf("\n\n");
            const dataLine = frame
              .split("\n")
              .find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const payload = dataLine.slice(5).trim();
            if (!payload || payload === "1") continue;
            try {
              const parsed = JSON.parse(payload) as PairingStreamEvent;
              await onEventRef.current(parsed);
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      } catch {
        /* aborted or network — caller stays in current state */
      }
    })();
    return () => controller.abort();
  }, [enabled, url, token]);
}
