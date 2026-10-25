import "server-only";
import { z } from "zod";
import { clientEnv } from "./env";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_OWNER_ID: z.coerce.number().int(),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODELS: z.string().default("openrouter/free"),
  IP_HASH_SALT: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

export const serverEnv = { ...clientEnv, ...serverSchema.parse(process.env) };
