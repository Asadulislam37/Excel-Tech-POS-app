import AgentChat from "@/components/AgentChat";

export const metadata = { title: "AI Assistant · Excel Tech POS" };

// Owner-facing business assistant. Sits inside the admin Shell; the /api/assistant
// route enforces admin/manager access.
export default function AssistantPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-3xl flex-col">
      <div className="mb-3">
        <h1 className="sec-title">AI Assistant</h1>
        <p className="mt-1 text-[13px] text-muted">
          Ask about sales, profit, stock, or ask it to draft marketing text. It reads your live data.
        </p>
      </div>
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <AgentChat
          endpoint="/api/assistant"
          className="min-h-0 flex-1"
          greeting="Ask me about your shop — today's sales, what to restock, what isn't selling — or ask me to draft a Facebook post."
          suggestions={[
            "Today's sales & profit",
            "What needs restocking?",
            "What isn't selling this month?",
            "Draft a Facebook post for a weekend offer",
          ]}
        />
      </div>
    </div>
  );
}
