import type { AutoMessageResult } from "../hooks/useContacts.js";

/**
 * Shape an auto-message outcome into a toast payload, or null when there's
 * nothing worth telling the user (module off or no template configured —
 * the user knew what they were asking for and silence is the right answer).
 *
 * Shared between the contact-creation flow and the check-in/check-out
 * dialogs so every entry point that triggers an auto-send gives the same
 * follow-up feedback.
 */
export function autoMessageToast(
  result: AutoMessageResult | undefined,
  contactName: string,
):
  | { variant: "success" | "error"; title: string; description?: string }
  | null {
  if (!result) return null;
  if (result.triggered) {
    return {
      variant: "success",
      title: `Auto message sent to ${contactName}`,
      description: `Template: ${result.templateName}`,
    };
  }
  if (result.reason === "send_failed") {
    return {
      variant: "error",
      title: "Auto message failed to send",
      description: "Check the WhatsApp connection and template content.",
    };
  }
  if (result.reason === "no_phone") {
    return {
      variant: "error",
      title: "Auto message skipped",
      description: `${contactName} has no phone number on file.`,
    };
  }
  if (result.reason === "template_missing") {
    return {
      variant: "error",
      title: "Auto message skipped",
      description: "The configured template no longer exists.",
    };
  }
  return null;
}
