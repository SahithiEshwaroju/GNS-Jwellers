import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null; name: string | null; avatarUrl: string | null };

/** Current signed-in user (verified with the auth server), or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const meta = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
    avatarUrl: (meta.avatar_url as string | undefined) ?? null,
  };
});

/** True when the current user is on the admin allow-list (checked in the database). */
export const isCurrentUserAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
});

/** For admin pages and actions: redirects signed-out users, returns null for non-admins. */
export async function requireAdminPage(): Promise<SessionUser | "forbidden"> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return (await isCurrentUserAdmin()) ? user : "forbidden";
}

export class AuthError extends Error {}

/** For server actions / route handlers: throws unless the caller is an admin. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin())) throw new AuthError("Not authorised");
  return user;
}
