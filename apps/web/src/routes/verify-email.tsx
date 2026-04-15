import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useToast } from "../components/toast.js";

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { push } = useToast();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        await api("/api/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });

        push({
          variant: "success",
          title: "Email verified!",
          description: "You can now log in to your account.",
        });
        setStatus("success");
      } catch (err) {
        push({
          variant: "error",
          title: "Verification failed",
          description: "The link is invalid or has expired.",
        });
        setStatus("error");
      }
    })();
  }, [token, push]);

  return (
    <div className="relative flex-1 flex items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-6 sm:p-8 text-center space-y-5 shadow-lift">
        {status === "verifying" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full" />
            </div>
            <h1 className="text-xl font-semibold">Verifying email</h1>
            <p className="text-sm text-slate-500">Please wait...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-4xl mb-2">✓</div>
            <h1 className="text-xl font-semibold">Email verified!</h1>
            <p className="text-sm text-slate-500 mb-4">
              Your email address has been successfully verified.
            </p>
            <Link to="/login" className="btn-primary w-full block text-center">
              Go to Login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-4xl mb-2">✕</div>
            <h1 className="text-xl font-semibold">Verification failed</h1>
            <p className="text-sm text-slate-500 mb-4">
              The link is invalid, expired, or has already been used.
            </p>
            <Link to="/login" className="btn-primary w-full block text-center">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
