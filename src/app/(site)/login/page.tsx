import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/site/GoogleSignInButton";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/saved");
  const { error } = await searchParams;
  return (
    <div className="wrap py-16">
      <div className="card mx-auto max-w-md bg-white p-8 text-center">
        <h1 className="text-[34px]">Sign in</h1>
        <p className="mt-2 text-muted">Sign in with Google to save designs. Browsing and enquiries don&apos;t need an account.</p>
        {error ? <p role="alert" className="mt-4 rounded bg-cancel-bg px-3 py-2 text-[14px] text-cancel-ink">Sign-in didn&apos;t complete. Please try again.</p> : null}
        <GoogleSignInButton next="/saved" className="mt-6" variant="primary" />
      </div>
    </div>
  );
}
