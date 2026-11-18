import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/site";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · GNS Jewellers" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  if (user === "forbidden") {
    return (
      <main className="grid min-h-screen place-items-center bg-admin-bg p-6">
        <div className="admin-card max-w-md p-8 text-center">
          <h1 className="text-[32px]">No admin access</h1>
          <p className="mt-3 text-muted">This Google account isn&apos;t on the admin list. Ask the shop owner to add your email in Admin Access.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="btn btn-outline">Back to website</Link>
            <form action="/auth/signout?to=admin" method="post"><button className="btn btn-primary" type="submit">Sign out</button></form>
          </div>
        </div>
      </main>
    );
  }
  const supabase = await createClient();
  const [{ data: badges }, settings] = await Promise.all([supabase.rpc("admin_badges"), getSettings()]);
  const newEnquiries = Number((badges as { new_enquiries?: number } | null)?.new_enquiries ?? 0);
  return (
    <div className="min-h-screen bg-admin-bg text-[14.5px] lg:flex">
      <Sidebar email={user.email ?? ""} newEnquiries={newEnquiries} shopName={settings.shop_name} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
