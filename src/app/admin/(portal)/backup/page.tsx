import { PageHeader } from "@/components/admin/PageHeader";
import { BackupPanel } from "@/components/admin/BackupPanel";

export const metadata = { title: "Backup" };

export default function BackupPage() {
  return (
    <>
      <PageHeader title="Backup" subtitle="Download a complete copy of the website — all photos, text, headings, products, rates, enquiries and orders — or restore one." />
      <BackupPanel />
    </>
  );
}
