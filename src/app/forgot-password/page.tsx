"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Store } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDevLink(d.devLink || "");
      setSent(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal"><Store size={24} className="text-white" /></div>
          <div className="text-center"><div className="text-lg font-bold">Excel Tech POS</div><div className="text-[12px] text-muted">Shyamoli Square, Dhaka</div></div>
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 size={40} className="mx-auto text-teal" />
              <h1 className="mt-3 text-lg font-bold">Check your email</h1>
              <p className="mt-1 text-[13px] text-muted">If an account exists for <b>{email}</b>, we&apos;ve sent a link to reset your password. It expires in 1 hour.</p>
              {devLink && (
                <div className="mt-4 rounded-md bg-ambersoft px-3 py-2 text-left text-[12px] text-amber">
                  Email isn&apos;t connected yet, so here&apos;s your reset link:
                  <Link href={devLink.replace(/^https?:\/\/[^/]+/, "")} className="mt-1 block break-all font-semibold underline">Open reset page →</Link>
                </div>
              )}
              <Link href="/login" className="btn btn-ghost mt-5 w-full">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold">Forgot password?</h1>
              <p className="mt-1 text-[13px] text-muted">Enter your account email and we&apos;ll send you a reset link.</p>
              <form className="mt-4 space-y-3" onSubmit={submit}>
                <label className="block text-[12px] font-semibold text-muted">Email
                  <input type="email" className="input mt-1" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
                </label>
                {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
                <button className="btn btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Sending…" : "Send reset link"}</button>
              </form>
              <div className="mt-4 text-center text-[13px] text-muted"><Link href="/login" className="font-semibold text-tealdark">Back to sign in</Link></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
