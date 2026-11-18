import { PageHeader } from "@/components/admin/PageHeader";
import { ContentForm } from "@/components/admin/ContentForm";
import { getSettings } from "@/lib/data/site";

export const metadata = { title: "Site Content" };

export default async function ContentPage() {
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Site Content" subtitle={<>Replace placeholder text and contact details at any time. Fields marked <span className="badge badge-sample">Placeholder</span> haven&apos;t been set yet.</>} />
      <ContentForm initial={s} />
    </>
  );
}
