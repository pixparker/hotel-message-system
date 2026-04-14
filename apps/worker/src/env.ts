import { EnvValidationError, loadServerEnv, type ServerEnv } from "@hms/shared";

function loadOrExit(): ServerEnv {
  try {
    return loadServerEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

export const env = loadOrExit();
export type Env = typeof env;
