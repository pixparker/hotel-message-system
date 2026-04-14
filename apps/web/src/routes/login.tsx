import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Loader2 } from "lucide-react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../state/auth.js";
import { useToast } from "../components/toast.js";

export function LoginPage() {
  const [email, setEmail] = useState("admin@hotel.local");
  const [password, setPassword] = useState("changeme");
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
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="hidden lg:flex items-end bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="font-semibold">Reform Hotel</div>
          </div>
          <h2 className="text-3xl font-semibold leading-tight">
            Reach every guest in seconds.
          </h2>
          <p className="mt-4 text-brand-100">
            One wizard, all your languages. Deliver personal WhatsApp messages
            without ever leaving the front desk.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form
          onSubmit={submit}
          className="card w-full max-w-sm p-8 space-y-5"
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
            <label className="label" htmlFor="password">
              Password
            </label>
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
        </form>
      </div>
    </div>
  );
}
