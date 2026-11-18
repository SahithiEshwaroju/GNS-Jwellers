import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/site/GoogleSignInButton";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user && (await isCurrentUserAdmin())) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#3f0d0c] p-6">
      <div className="w-full max-w-md rounded-lg bg-card p-8 text-center shadow-[var(--shadow-modal)]">
        <Icon name="lotus-logo" size={44} className="mx-auto text-burgundy" />
        <h1 className="mt-2 text-[34px]">Admin Portal</h1>
        <p className="mt-2 text-muted">Sign in with the Google account the shop has authorised.</p>
        {error ? <p role="alert" className="mt-4 rounded bg-cancel-bg px-3 py-2 text-[14px] text-cancel-ink">Sign-in didn&apos;t complete. Please try again.</p> : null}
        {user ? (
          <div className="mt-6 rounded-md bg-note-bg p-4 text-[14px]">
            <p>You&apos;re signed in as <b>{user.email}</b>, which doesn&apos;t have admin access.</p>
            <form action="/auth/signout?to=admin" method="post" className="mt-3"><button className="btn btn-outline btn-sm" type="submit">Use a different account</button></form>
          </div>
        ) : (
          <GoogleSignInButton next="/admin" className="mt-6" />
        )}
        <Link href="/" className="mt-6 inline-block text-[14px] text-burgundy underline">Back to website</Link>
      </div>
    </main>
  );
}
