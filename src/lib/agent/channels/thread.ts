// Per-user conversation memory for messaging channels (Messenger / WhatsApp).
// Serverless functions have no in-memory state, so we persist a small rolling
// history per (channel, user). Stored in the existing Setting key/value table
// under a namespaced key — no schema migration needed. Good enough for a shop;
// can move to a dedicated table later if volume grows.
import { prisma } from "@/lib/prisma";
import type { ChatTurn } from "@/lib/agent/run";

const PREFIX = "agent:thread:";
const MAX_TURNS = 12; // keep the last ~6 exchanges
const RESET_AFTER_MS = 6 * 60 * 60 * 1000; // start fresh after 6h idle
const HANDOFF_QUIET_MS = 2 * 60 * 60 * 1000; // stay silent 2h after handing to a human

export type ThreadState = {
  turns: ChatTurn[];
  updatedAt: number;
  handedOffAt?: number;
  lastMessageId?: string;
};

const keyFor = (channel: string, externalId: string) => `${PREFIX}${channel}:${externalId}`;

export async function loadThread(channel: string, externalId: string): Promise<ThreadState> {
  const row = await prisma.setting.findUnique({ where: { key: keyFor(channel, externalId) } });
  if (!row) return { turns: [], updatedAt: 0 };
  try {
    const s = JSON.parse(row.value) as ThreadState;
    // Drop stale context but keep handoff/last-id bookkeeping.
    if (Date.now() - (s.updatedAt || 0) > RESET_AFTER_MS) {
      return { turns: [], updatedAt: 0, handedOffAt: s.handedOffAt, lastMessageId: s.lastMessageId };
    }
    return { turns: s.turns ?? [], updatedAt: s.updatedAt ?? 0, handedOffAt: s.handedOffAt, lastMessageId: s.lastMessageId };
  } catch {
    return { turns: [], updatedAt: 0 };
  }
}

export async function saveThread(channel: string, externalId: string, state: ThreadState): Promise<void> {
  const value = JSON.stringify({ ...state, turns: state.turns.slice(-MAX_TURNS), updatedAt: Date.now() });
  const key = keyFor(channel, externalId);
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** True if a human took over recently and the bot should stay quiet. */
export function isHandedOff(state: ThreadState): boolean {
  return !!state.handedOffAt && Date.now() - state.handedOffAt < HANDOFF_QUIET_MS;
}
