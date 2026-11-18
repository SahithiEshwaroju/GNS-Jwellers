import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductForm, EMPTY_PRODUCT } from "@/components/admin/ProductForm";
import { formDeps } from "../_shared";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const deps = await formDeps();
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-[14px] text-burgundy">← Back to products</Link>
      <PageHeader title="Add product" subtitle="Only photos, name and pricing inputs are needed. Everything else is optional." />
      <ProductForm initial={EMPTY_PRODUCT} {...deps} />
    </>
  );
}
