import type { Metadata } from "next";
import { getSettings } from "@/lib/data/site";

export const metadata: Metadata = { title: "Terms of Use" };

export default async function Page() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-[860px] px-[18px] pb-6 pt-10 md:px-8">
      <h1 className="h-page">Terms of Use</h1>
      {s.terms_text ? (
        <div className="mt-6 whitespace-pre-line text-[16px] text-espresso">{s.terms_text}</div>
      ) : (
        <p className="mt-6 text-muted">The {s.shop_name} Terms of Use will be published here soon.</p>
      )}
    </div>
  );
}
