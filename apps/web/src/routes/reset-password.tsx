import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api.js";
import { useToast } from "../components/toast.js";

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { push } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const token = searchParams.get("token");

  if (!token) {
    return (
      <div className="relative flex-1 flex items-center justify-center bg-slate-50 p-4">
        <div className="card w-full max-w-sm p-6 sm:p-8 text-center space-y-5 shadow-lift">
          <h1 className="text-xl font-semibold">Invalid Link</h1>
          <p className="text-sm text-slate-500">
            This password reset link is invalid or missing. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn-primary w-full block text-center">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      push({
        variant: "error",
        title: "Password required",
        description: "Please enter a new password.",
      });
      return;
    }
    if (password.length < 8) {
      push({
        variant: "error",
        title: "Password too short",
        description: "Password must be at least 8 characters.",
      });
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      push({
        variant: "success",
        title: "Password updated",
        description: "Your password has been successfully reset.",
      });

      // Navigate to login after a short delay
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      push({
        variant: "error",
        title: "Reset failed",
        description: "Invalid or expired reset link. Please try again.",
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
            Reset password
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your new password below.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="password">
            New Password
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
            autoFocus
          />
          {password && password.length < 8 && (
            <p className="text-xs text-red-600 mt-1">Must be at least 8 characters</p>
          )}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading || password.length < 8}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            "Update Password"
          )}
        </button>
        <div className="text-center text-sm text-slate-500">
          Back to{" "}
          <Link to="/login" className="text-slate-700 hover:text-slate-900 font-medium">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
