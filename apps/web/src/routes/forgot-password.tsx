import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../lib/api.js";
import { useToast } from "../components/toast.js";

export function ForgotPassword() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      push({
        variant: "error",
        title: "Email required",
        description: "Please enter your email address.",
      });
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      push({
        variant: "success",
        title: "Check your email",
        description: "If that email exists, a password reset link was sent.",
      });

      // Navigate to login after a short delay
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      push({
        variant: "error",
        title: "Error",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex-1 flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={submit}
        className="card w-full max-w-sm p-6 sm:p-8 space-y-5 shadow-lift"
        aria-labelledby="reset-heading"
      >
        <div>
          <h1 id="reset-heading" className="text-xl font-semibold">
            Forgot password?
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your email and we'll send you a reset link.
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
            placeholder="admin@hotel.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Send Reset Link"
          )}
        </button>
        <div className="text-center text-sm text-slate-500">
          Remember your password?{" "}
          <Link to="/login" className="text-slate-700 hover:text-slate-900 font-medium">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
