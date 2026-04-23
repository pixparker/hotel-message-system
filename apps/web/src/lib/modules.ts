/**
 * First-party module registry. The product layer treats modules as a
 * configurable surface, but the catalog itself is code-defined for now —
 * no plugin runtime, no marketplace.
 *
 * Adding a module: append an entry here, ship its settings UI under
 * /settings/modules/<key>, and any per-workspace state in `settings.modules`.
 */

import type { ComponentType } from "react";
import { BedDouble } from "lucide-react";

export type ModuleKey = "check_in";

export interface ModuleDefinition {
  key: ModuleKey;
  /** Display name on the Modules page and in the Settings tab. */
  name: string;
  /** Short value-prop shown on the module card. */
  description: string;
  /** Icon for cards and module headers. */
  icon: ComponentType<{ className?: string }>;
  /**
   * For MVP every module ships as installed. The toggle that turns the
   * module's behavior on/off lives inside its own settings (e.g. Check-In's
   * `enabled` flag), so this stays as a static catalog property.
   */
  installed: true;
  /** Where the module's per-workspace configuration lives. */
  settingsPath: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    key: "check_in",
    name: "Check-In",
    description:
      "Automatically send a WhatsApp message when a guest checks in or checks out — welcomes, Wi-Fi info, thank-you notes, and feedback prompts.",
    icon: BedDouble,
    installed: true,
    settingsPath: "/settings/modules",
  },
];
