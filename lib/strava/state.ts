import "server-only";

import * as crypto from "node:crypto";

import { getServiceRoleClient } from "../supabase";

const STATE_TTL_MS = 10 * 60 * 1000;

export async function issueState(): Promise<string> {
  const supabase = getServiceRoleClient();
  const state = crypto.randomBytes(32).toString("hex");
  const { error } = await supabase.from("oauth_states").insert({ state });
  if (error) throw new Error(`Failed to issue OAuth state: ${error.message}`);
  return state;
}

export async function consumeState(state: string): Promise<boolean> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("oauth_states")
    .delete()
    .eq("state", state)
    .select("state, created_at")
    .maybeSingle();
  if (error) throw new Error(`Failed to consume OAuth state: ${error.message}`);
  if (!data) return false;
  const createdAtMs = new Date(data.created_at).getTime();
  return Date.now() - createdAtMs <= STATE_TTL_MS;
}
