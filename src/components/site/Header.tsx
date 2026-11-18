import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { getCategories, getSettings } from "@/lib/data/site";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { AccountMenu } from "./AccountMenu";

export async function Header() {
  const [settings, categories, user, admin] = await Promise.all([getSettings(), getCategories(), getCurrentUser(), isCurrentUserAdmin()]);
  const cats = categories.map((c) => ({ name: c.name, slug: c.slug }));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-burgundy px-3 py-2 text-white">Skip to content</a>
      <div className="wrap flex h-16 items-center justify-between gap-4 lg:h-[68px]">
        <div className="flex items-center lg:hidden">
          <MobileMenu categories={cats} />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
          <Logo name={settings.shop_name} tagline={settings.tagline} />
        </div>
        <NavLinks categories={cats} />
        <div className="flex items-center gap-1 lg:gap-3">
          <form action="/jewellery" role="search" className="relative hidden xl:block">
            <label htmlFor="header-search" className="sr-only">Search jewellery</label>
            <input id="header-search" name="q" type="search" placeholder="Search jewellery..." className="input h-10 w-[230px] pr-10" maxLength={80} />
            <button type="submit" className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-espresso" aria-label="Search">
              <Icon name="search" />
            </button>
          </form>
          <Link href="/jewellery" className="hidden h-11 w-11 place-items-center text-espresso lg:grid xl:hidden" aria-label="Search jewellery">
            <Icon name="search" size={20} />
          </Link>
          <Link href="/saved" className="grid h-11 w-11 place-items-center text-espresso hover:text-burgundy" aria-label="Saved designs">
            <Icon name="heart-outline" size={20} />
          </Link>
          <AccountMenu user={user ? { name: user.name, email: user.email } : null} isAdmin={admin} />
        </div>
      </div>
    </header>
  );
}
