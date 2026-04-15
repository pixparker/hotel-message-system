import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../lib/api.js";
import { useToast } from "../components/toast.js";

export function SignupPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [populate, setPopulate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          orgName,
          email,
          password,
          populateSampleData: populate,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      push({
        variant: "error",
        title: "Sign-up failed",
        description:
          err instanceof ApiError && err.status === 400
            ? "That email is already in use — try logging in instead."
            : "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="relative flex-1 flex items-center justify-center bg-slate-50 p-4">
        <div className="card w-full max-w-sm p-6 sm:p-8 text-center space-y-5 shadow-lift">
          <div className="text-4xl mb-2">✓</div>
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-slate-500">
            We sent a verification link to <b>{email}</b>. Click it to activate your account.
          </p>
          <Link to="/login" className="btn-primary w-full block text-center">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={submit}
        className="card w-full max-w-md p-6 sm:p-8 space-y-5 shadow-lift"
        aria-labelledby="signup-heading"
      >
        <div>
          <h1 id="signup-heading" className="text-xl font-semibold">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Set up a workspace for your hotel.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="orgName">
            Hotel name
          </label>
          <input
            id="orgName"
            type="text"
            className="input mt-1"
            placeholder="Reform Hotel"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label" htmlFor="email">
            Your email
          </label>
          <input
            id="email"
            type="email"
            className="input mt-1"
            placeholder="you@hotel.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
          {password && password.length < 8 && (
            <p className="text-xs text-red-600 mt-1">Must be at least 8 characters</p>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={populate}
            onChange={(e) => setPopulate(e.target.checked)}
          />
          <div>
            <div className="text-sm font-medium">Populate with sample data</div>
            <div className="text-xs text-slate-500">
              Adds 15 guests and 3 templates so you can explore the app. Delete any time from Settings.
            </div>
          </div>
        </label>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || password.length < 8}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>

        <div className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-slate-700 hover:text-slate-900 font-medium">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
