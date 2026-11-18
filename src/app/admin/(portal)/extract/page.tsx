import { PageHeader } from "@/components/admin/PageHeader";
import { ExtractTool } from "@/components/admin/ExtractTool";
import { geminiConfigured, r2Configured } from "@/lib/server-env";

export const metadata = { title: "AI Catalogue Extraction" };

export default function ExtractPage() {
  return (
    <>
      <PageHeader title="AI Catalogue Extraction" badge={<span className="badge badge-sample">Beta</span>} subtitle="Upload or capture a catalogue page — AI reads the text and fills a draft for you to check." />
      <ExtractTool ready={geminiConfigured() && r2Configured()} />
    </>
  );
}
