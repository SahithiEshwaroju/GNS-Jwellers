import { Header } from "@/components/site/Header";
import { RateBar } from "@/components/site/RateBar";
import { Footer } from "@/components/site/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <RateBar />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
