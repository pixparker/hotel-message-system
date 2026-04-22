import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

/**
 * WhatsApp-style delivery indicator:
 *   queued    → clock
 *   sent      → single grey tick
 *   delivered → double grey tick
 *   read      → double blue tick  (the iconic WhatsApp blue)
 *   failed    → red alert circle
 */
export function MessageStatusIcon({
  status,
  className = "h-3.5 w-3.5",
}: {
  status: string;
  className?: string;
}) {
  switch (status) {
    case "read":
      return <CheckCheck className={`${className} text-sky-500`} aria-label="Read" />;
    case "delivered":
      return (
        <CheckCheck className={`${className} text-slate-400`} aria-label="Delivered" />
      );
    case "sent":
      return <Check className={`${className} text-slate-400`} aria-label="Sent" />;
    case "failed":
      return (
        <AlertCircle className={`${className} text-rose-600`} aria-label="Failed" />
      );
    default:
      return (
        <Clock className={`${className} text-slate-400`} aria-label="Pending" />
      );
  }
}
