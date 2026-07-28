"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Store } from "lucide-react";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isLogin ? { email, password } : { name, email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal">
            <Store size={24} className="text-white" />
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">Excel Tech POS</div>
            <div className="text-[12px] text-muted">Shyamoli Square, Dhaka</div>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-bold">{isLogin ? "Sign in" : "Create your account"}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {isLogin ? "Welcome back. Enter your details to continue." : "Set up your account to start using the POS."}
          </p>

          <form className="mt-4 space-y-3" onSubmit={submit}>
            {!isLogin && (
              <label className="block text-[12px] font-semibold text-muted">Full Name
                <input className="input mt-1" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </label>
            )}
            <label className="block text-[12px] font-semibold text-muted">Email
              <input type="email" className="input mt-1" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} autoFocus={isLogin} autoComplete="email" />
            </label>
            <label className="block text-[12px] font-semibold text-muted">
              <span className="flex items-center justify-between">Password
                {isLogin && <Link href="/forgot-password" className="text-[11px] font-semibold text-tealdark">Forgot password?</Link>}
              </span>
              <div className="relative mt-1">
                <input type={show ? "text" : "password"} className="input pr-10" placeholder={isLogin ? "Your password" : "At least 6 characters"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? "current-password" : "new-password"} />
                <button type="button" className="absolute right-3 top-2.5 text-muted" onClick={() => setShow((s) => !s)}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}

            <button className="btn btn-primary w-full py-3" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-4 text-center text-[13px] text-muted">
            {isLogin ? (
              <>New here? <Link href="/signup" className="font-semibold text-tealdark">Create an account</Link></>
            ) : (
              <>Already have an account? <Link href="/login" className="font-semibold text-tealdark">Sign in</Link></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
