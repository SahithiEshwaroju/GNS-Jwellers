"use client";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { GoogleMark } from "@/components/ui/Icon";

export function GoogleSignInButton({ next = "/", label = "Sign in with Google", className = "", variant = "outline" }: { next?: string; label?: string; className?: string; variant?: "outline" | "primary" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await getBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setError("Google sign-in isn't available right now. Please try again later.");
      setBusy(false);
    }
  }
  return (
    <div className={className}>
      <button type="button" onClick={go} disabled={busy} className={`btn ${variant === "primary" ? "btn-primary" : "btn-outline"} w-full`}>
        {variant === "outline" ? <span className="grid h-6 w-6 place-items-center rounded-full bg-white"><GoogleMark size={16} /></span> : null}
        {busy ? "Opening Google…" : label}
      </button>
      {error ? <p className="err" role="alert">{error}</p> : null}
    </div>
  );
}
