import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getConfig } from "./config";

let cached: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const config = getConfig();
  cached = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
