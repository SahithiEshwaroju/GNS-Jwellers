import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductForm, type FormProduct } from "@/components/admin/ProductForm";
import type { ProductPhoto } from "@/components/admin/PhotoManager";
import { createClient } from "@/lib/supabase/server";
import { formDeps } from "../_shared";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: imgs }, { data: tags }, deps] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_images").select("media_id, view_label").eq("product_id", id).order("sort_order"),
    supabase.from("product_tags").select("tags(name)").eq("product_id", id),
    formDeps(),
  ]);
  if (!p) notFound();
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const initial: FormProduct = {
    id: p.id, code: p.code, status: p.status, is_sample: p.is_sample, name: p.name, category_id: p.category_id,
    subcategory_id: s(p.subcategory_id), collection_id: s(p.collection_id), description: s(p.description), model_description: s(p.model_description),
    metal: p.metal as "gold" | "silver", karat: s(p.karat ?? 22), silver_purity: s(p.silver_purity), weight_g: s(p.weight_g),
    making_type: p.making_type as FormProduct["making_type"], making_value: s(p.making_value), stone_value: s(p.stone_value),
    stones_note: s(p.stones_note), style: s(p.style), occasion: s(p.occasion), gender: s(p.gender),
    specifications: (Array.isArray(p.specifications) ? p.specifications : []) as { label: string; value: string }[],
    tags: ((tags ?? []) as unknown as { tags: { name: string } | null }[]).map((t) => t.tags?.name).filter((n): n is string => !!n),
    images: (imgs ?? []) as ProductPhoto[],
  };
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-[14px] text-burgundy">← Back to products</Link>
      <PageHeader title={p.name} subtitle={`${p.code} · ${p.status === "published" ? "Published" : "Draft"}`} />
      <ProductForm key={p.updated_at} initial={initial} {...deps} />
    </>
  );
}
