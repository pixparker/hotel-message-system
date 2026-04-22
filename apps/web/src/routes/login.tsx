import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { WhatsAppIcon } from "../components/WhatsAppIcon.js";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../state/auth.js";
import { useToast } from "../components/toast.js";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const { push } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; role: "admin" | "staff"; testPhone?: string };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(res.user, res.accessToken, res.refreshToken);
      navigate("/");
    } catch (err) {
      push({
        variant: "error",
        title: "Sign-in failed",
        description:
          err instanceof ApiError && err.status === 401
            ? "Email or password is incorrect."
            : "Unable to reach the server. Try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex-1 grid lg:grid-cols-2 min-h-0 overflow-hidden">
      {/* Mobile-only background: full-bleed hotel image with a brand overlay. */}
      <div
        aria-hidden
        className="lg:hidden absolute inset-0 bg-slate-900 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80')",
        }}
      />
      <div
        aria-hidden
        className="lg:hidden absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/65 to-slate-900/85"
      />

      {/* Desktop hero — untouched on large screens. */}
      <div
        className="relative hidden lg:flex items-end text-white p-12 overflow-hidden bg-slate-900"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-slate-900/85" />
        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-md">
              <WhatsAppIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Reform Hotel</div>
              <div className="text-xs text-brand-100/80">WhatsApp guest messaging</div>
            </div>
          </div>
          <h2 className="text-4xl font-semibold leading-tight">
            Reach every guest in seconds.
          </h2>
          <p className="mt-4 text-brand-50/90 text-lg leading-relaxed">
            One wizard, all your languages. Deliver personal WhatsApp messages
            without ever leaving the front desk.
          </p>
          <div className="mt-8 flex gap-6 text-sm">
            <div>
              <div className="text-2xl font-semibold tabular-nums">98%</div>
              <div className="text-brand-100/80">WhatsApp read rate</div>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <div className="text-2xl font-semibold tabular-nums">&lt;30s</div>
              <div className="text-brand-100/80">to send a campaign</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-6 p-4 sm:p-8">
        {/* Mobile-only brand chip over the image */}
        <div className="lg:hidden flex items-center gap-3 text-white drop-shadow">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-[0_10px_24px_-8px_rgba(37,211,102,0.65)] ring-1 ring-inset ring-white/20">
            <WhatsAppIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold">Reform Hotel</div>
            <div className="text-xs text-brand-100/90">WhatsApp guest messaging</div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="card w-full max-w-sm p-6 sm:p-8 space-y-5 shadow-lift"
          aria-labelledby="login-heading"
        >
          <div>
            <h1 id="login-heading" className="text-xl font-semibold">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to the guest messaging console.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label" htmlFor="password">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
          <div className="text-center text-sm text-slate-500">
            New here?{" "}
            <Link to="/signup" className="text-slate-700 hover:text-slate-900 font-medium">
              Create an account
            </Link>
          </div>
        </form>
        <div className="text-xs text-slate-400/90 select-all">
          build {__APP_VERSION__}
        </div>
      </div>
    </div>
  );
}
