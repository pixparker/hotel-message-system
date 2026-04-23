import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { Page } from "../components/Page.js";
import { api, ApiError } from "../lib/api.js";
import { useToast } from "../components/toast.js";

/**
 * Guided WhatsApp Cloud API connect wizard.
 * Admin pastes credentials; we run a test send before persisting.
 * Access token + app secret are encrypted server-side.
 */
export function WhatsAppConnectPage() {
  const navigate = useNavigate();
  const { push } = useToast();

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/settings/whatsapp/connect", {
        method: "POST",
        body: JSON.stringify({
          phoneNumberId,
          wabaId,
          accessToken,
          appSecret,
          testPhone,
        }),
      });
      push({
        variant: "success",
        title: "WhatsApp connected",
        description: "Test message sent. Credentials saved (encrypted).",
      });
      navigate("/settings/whatsapp");
    } catch (err) {
      const detail =
        err instanceof ApiError && (err.body as { detail?: string })?.detail
          ? (err.body as { detail?: string }).detail
          : undefined;
      push({
        variant: "error",
        title: "Connect failed",
        description: detail ?? "Check your credentials and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page
      title="Connect WhatsApp"
      description="Paste your Meta Business Platform credentials. We'll send a test message to verify the connection before saving. Your access token and app secret are encrypted at rest."
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          to="/settings/whatsapp"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>

        <form onSubmit={connect} className="card p-6 space-y-5 shadow-lift">
          <div>
            <label className="label" htmlFor="phoneNumberId">
              Phone number ID
            </label>
            <input
              id="phoneNumberId"
              className="input mt-1"
              placeholder="123456789012345"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              From Meta Business Manager → WhatsApp → API Setup
            </p>
          </div>

          <div>
            <label className="label" htmlFor="wabaId">
              WhatsApp Business Account ID (WABA)
            </label>
            <input
              id="wabaId"
              className="input mt-1"
              placeholder="987654321098765"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="accessToken">
              Permanent access token
            </label>
            <input
              id="accessToken"
              type="password"
              className="input mt-1"
              placeholder="EAA..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Generate a System User token with <code>whatsapp_business_messaging</code>.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="appSecret">
              App secret
            </label>
            <input
              id="appSecret"
              type="password"
              className="input mt-1"
              placeholder="••••••••••••"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              From your Meta App → Settings → Basic → App Secret. Used to verify webhook signatures.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="testPhone">
              Test phone number
            </label>
            <input
              id="testPhone"
              type="tel"
              className="input mt-1"
              placeholder="+905551112233"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              We'll send "Your account is connected" here to verify.
            </p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending test…
              </>
            ) : (
              "Test & Connect"
            )}
          </button>
        </form>
      </div>
    </Page>
  );
}
