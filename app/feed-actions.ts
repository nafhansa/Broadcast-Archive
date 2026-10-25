"use server";

import { listBroadcasts, listAspirations, type FeedPage, type AspirationRow } from "@/lib/queries";
import type { FeedParams } from "@/lib/types";

export async function loadMoreBroadcasts(params: FeedParams, cursor: string): Promise<FeedPage> {
  return listBroadcasts({ cat: params.cat, q: params.q }, cursor);
}

export async function loadMoreAspirations(
  pojokId: string,
  opts: { normalized?: string; before?: string },
): Promise<{ items: AspirationRow[]; next: string | null }> {
  if (!/^[0-9a-f-]{36}$/.test(pojokId)) return { items: [], next: null };
  return listAspirations(pojokId, opts);
}
