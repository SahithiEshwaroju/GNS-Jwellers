import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { getCurrentUser } from "@/lib/auth";
import { getSavedProducts } from "@/lib/data/saved";
import { GoogleSignInButton } from "@/components/site/GoogleSignInButton";
import { SavedList } from "@/components/site/SavedList";

export const metadata: Metadata = { title: "Saved designs" };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ signin?: string }> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const items = user ? await getSavedProducts() : [];
  return (
    <div className="wrap pb-6 pt-5">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-[14px] text-muted">
        <Link href="/" className="hover:text-burgundy">Home</Link><Icon name="chevron-right" size={12} /><span aria-current="page" className="text-espresso">Saved designs</span>
      </nav>
      <h1 className="h-page">Saved designs</h1>
      {!user ? (
        <div className="mt-6 rounded-md border border-dashed border-line bg-card px-6 py-14 text-center">
          <h2 className="text-[30px]">Sign in to save designs</h2>
          <p className="mt-3 text-muted">
            {sp.signin ? "You need to sign in before saving a design. " : ""}Saving is optional — you can browse and enquire without an account.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <GoogleSignInButton next="/saved" variant="primary" />
          </div>
        </div>
      ) : items.length ? (
        <SavedList items={items} userName={user.name ?? ""} />
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-line bg-card px-6 py-14 text-center">
          <Icon name="heart-outline" size={34} className="mx-auto text-burgundy" />
          <h2 className="mt-3 text-[30px]">No saved designs yet</h2>
          <p className="mt-2 text-muted">Tap the heart on any design to keep it here.</p>
          <Link href="/jewellery" className="btn btn-primary mt-6">Browse jewellery</Link>
        </div>
      )}
    </div>
  );
}
