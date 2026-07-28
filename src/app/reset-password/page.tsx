"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Store } from "lucide-react";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password !== confirm) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.replace("/");
      router.refresh();
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
          <h1 className="text-lg font-bold">Set a new password</h1>
          <p className="mt-1 text-[13px] text-muted">Choose a new password for your account.</p>
          {!token ? (
            <div className="mt-4 rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">This reset link is missing its token. Request a new one from <Link href="/forgot-password" className="underline">Forgot password</Link>.</div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={submit}>
              <label className="block text-[12px] font-semibold text-muted">New Password
                <div className="relative mt-1">
                  <input type={show ? "text" : "password"} className="input pr-10" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" />
                  <button type="button" className="absolute right-3 top-2.5 text-muted" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </label>
              <label className="block text-[12px] font-semibold text-muted">Confirm Password
                <input type={show ? "text" : "password"} className="input mt-1" placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </label>
              {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
              <button className="btn btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Saving…" : "Reset password"}</button>
            </form>
          )}
          <div className="mt-4 text-center text-[13px] text-muted"><Link href="/login" className="font-semibold text-tealdark">Back to sign in</Link></div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetInner /></Suspense>;
}
