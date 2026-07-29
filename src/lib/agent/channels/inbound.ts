// Shared inbound-message handler for messaging channels. Ties together
// conversation memory + the customer agent + the channel's send function, so
// Messenger and WhatsApp both go through one path (and the same agent brain as
// the website chat).
import { runCustomerAgent } from "@/lib/agent/customer";
import { isGeminiConfigured } from "@/lib/agent/gemini";
import { loadThread, saveThread, isHandedOff, type ThreadState } from "@/lib/agent/channels/thread";

export async function handleInboundMessage(opts: {
  channel: "messenger" | "whatsapp";
  externalId: string; // PSID (Messenger) or phone number (WhatsApp)
  messageId?: string;
  text: string;
  send: (text: string) => Promise<void>;
}): Promise<void> {
  const { channel, externalId, messageId, text, send } = opts;
  const clean = text?.trim();
  if (!clean || !isGeminiConfigured()) return;

  const state = await loadThread(channel, externalId);

  // Ignore duplicate deliveries (Meta retries webhooks).
  if (messageId && state.lastMessageId === messageId) return;

  // If a human recently took over, let them handle it — stay quiet.
  if (isHandedOff(state)) {
    await saveThread(channel, externalId, { ...state, lastMessageId: messageId });
    return;
  }

  const history = [...state.turns, { role: "user" as const, text: clean }];
  const { reply, toolCalls } = await runCustomerAgent(history);

  const next: ThreadState = {
    ...state,
    turns: [...history, { role: "model", text: reply }],
    lastMessageId: messageId,
    // Once the agent hands off, mute the bot for a while so it doesn't talk over staff.
    handedOffAt: toolCalls.includes("request_human") ? Date.now() : state.handedOffAt,
  };
  await saveThread(channel, externalId, next);

  await send(reply);
}
