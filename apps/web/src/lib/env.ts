import { EnvValidationError, loadWebEnv, type WebEnv } from "@hms/shared";

function parseOrThrow(): WebEnv {
  try {
    return loadWebEnv(import.meta.env as Record<string, unknown>);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(err.message);
    }
    throw err;
  }
}

export const env = parseOrThrow();
