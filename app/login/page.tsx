"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setNotice("Sign-in initiated. If email confirmation is enabled, verify your email then sign in again.");
        setLoading(false);
        return;
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setNotice("Account created. Check your email to confirm, then click Sign In.");
        setLoading(false);
        return;
      }
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form onSubmit={submitAuth} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Access Your Account</h1>
        <p className="text-sm text-slate-500">Use Sign In for existing users, or Create Account for new users.</p>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="submit"
            disabled={loading}
            onClick={() => setMode("signin")}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {loading && mode === "signin" ? "Signing In..." : "Sign In"}
          </button>
          <button
            type="submit"
            disabled={loading}
            onClick={() => setMode("signup")}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-70"
          >
            {loading && mode === "signup" ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>
    </main>
  );
}
