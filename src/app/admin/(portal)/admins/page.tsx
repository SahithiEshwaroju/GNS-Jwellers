import { PageHeader } from "@/components/admin/PageHeader";
import { AdminsManager } from "@/components/admin/AdminsManager";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin Access" };

export default async function AdminsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_admins");
  return (
    <>
      <PageHeader title="Admin Access" subtitle="People who can sign in to this portal with Google. All admins have the same full access." />
      <AdminsManager admins={data ?? []} />
    </>
  );
}
