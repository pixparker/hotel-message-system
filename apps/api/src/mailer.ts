import { Resend } from "resend";
import { env } from "./env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Send email verification link. In dev mode (no RESEND_API_KEY), logs to console.
 */
export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  if (!resend) {
    console.log(`[DEV] Email verification link for ${to}:\n${url}`);
    return;
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Verify your email address",
    html: `
      <p>Click the link below to verify your email address:</p>
      <a href="${url}">Verify Email</a>
      <p>This link expires in 15 minutes.</p>
    `,
  });
}

/**
 * Send password reset link. In dev mode (no RESEND_API_KEY), logs to console.
 */
export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  if (!resend) {
    console.log(`[DEV] Password reset link for ${to}:\n${url}`);
    return;
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `
      <p>Click the link below to reset your password:</p>
      <a href="${url}">Reset Password</a>
      <p>This link expires in 15 minutes. If you didn't request this, you can safely ignore it.</p>
    `,
  });
}
