// Shared inbound-message handler for messaging channels. Ties together
// conversation memory + the customer agent + the channel's send function, so
// Messenger and WhatsApp both go through one path (and the same agent brain as
// the website chat).
import { runCustomerAgent } from "@/lib/agent/customer";
import { isGeminiConfigured } from "@/lib/agent/gemini";
import { loadThread, saveThread, isHandedOff, type ThreadState } from "@/lib/agent/channels/thread";
import { analyzeCoverPhoto } from "@/lib/agent/vision";
import { saveSourcingRequest } from "@/lib/sourcing";

export async function handleInboundMessage(opts: {
  channel: "messenger" | "whatsapp" | "instagram";
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

// A customer sent a PHOTO (to source from Taobao/PDD). Analyze it with vision,
// log a sourcing request for the owner, acknowledge the customer, and step back
// so the owner can source + quote.
export async function handleInboundImage(opts: {
  channel: "messenger" | "whatsapp" | "instagram";
  externalId: string;
  messageId?: string;
  base64: string;
  mimeType: string;
  caption?: string;
  customerName?: string;
  photoUrl?: string;
  send: (text: string) => Promise<void>;
}): Promise<void> {
  const { channel, externalId, messageId, base64, mimeType, caption, customerName, photoUrl, send } = opts;
  if (!isGeminiConfigured()) return;

  const state = await loadThread(channel, externalId);
  if (messageId && state.lastMessageId === messageId) return;
  if (isHandedOff(state)) {
    await saveThread(channel, externalId, { ...state, lastMessageId: messageId });
    return;
  }

  let analysis: Awaited<ReturnType<typeof analyzeCoverPhoto>> | null = null;
  try {
    analysis = await analyzeCoverPhoto(base64, mimeType);
  } catch (e) {
    console.error("[inbound image] vision failed", e);
  }

  // Log the sourcing request for the owner (keywords/links stay private — never
  // sent to the customer).
  if (analysis) {
    try {
      await saveSourcingRequest({ channel, externalId, customerName, photoUrl, ...analysis });
    } catch (e) {
      console.error("[inbound image] save request failed", e);
    }
  }

  // Reply in the customer's language via the normal agent, given a context turn.
  const ctx = analysis
    ? `[The customer just sent a photo of a phone case/accessory they want us to source. Image analysis: ${analysis.description}${analysis.phoneModel ? ` — looks like it's for ${analysis.phoneModel}` : ""}.${caption ? ` They also wrote: "${caption}".` : ""}] Acknowledge the photo warmly, confirm which phone model it's for if unclear, and tell them you'll check the price with the team and get back to them shortly. Do NOT quote any price now, and do NOT mention Taobao, China, or sourcing costs.`
    : `[The customer sent a photo but our system couldn't read it.] Politely ask them to resend a clearer photo and to mention which phone model it's for.`;

  const { reply } = await runCustomerAgent([...state.turns, { role: "user", text: ctx }]);

  await saveThread(channel, externalId, {
    ...state,
    turns: [
      ...state.turns,
      { role: "user", text: caption ? `📷 [photo] ${caption}` : "📷 [sent a photo]" },
      { role: "model", text: reply },
    ],
    lastMessageId: messageId,
    // Step back so the owner can source + quote without the bot interjecting.
    handedOffAt: analysis ? Date.now() : state.handedOffAt,
  });

  await send(reply);
}
