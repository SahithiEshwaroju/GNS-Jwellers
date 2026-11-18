import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { OrderForm } from "@/components/admin/OrderForm";
import { createClient } from "@/lib/supabase/server";
import { todayIST } from "@/lib/format";

export const metadata = { title: "New order" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ enquiry?: string }> }) {
  const { enquiry } = await searchParams;
  let prefill: Parameters<typeof OrderForm>[0]["prefill"];
  if (enquiry && /^[0-9a-f-]{36}$/.test(enquiry)) {
    const supabase = await createClient();
    const [{ data: e }, { data: items }] = await Promise.all([
      supabase.from("enquiries").select("id, ref, customer_name, mobile, email").eq("id", enquiry).maybeSingle(),
      supabase.from("enquiry_items").select("product_id, product_code, product_name").eq("enquiry_id", enquiry).order("sort_order"),
    ]);
    if (e) prefill = { enquiryId: e.id, enquiryRef: e.ref, customer_name: e.customer_name, mobile: e.mobile, email: e.email ?? "", items: (items ?? []).map((i) => ({ product_id: i.product_id ?? undefined, product_code: i.product_code, product_name: i.product_name, details: "", quantity: 1 })) };
  }
  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex text-[14px] text-burgundy">← Back to orders</Link>
      <PageHeader title="Create new order" subtitle="The order number is generated when you confirm the order." />
      <OrderForm today={todayIST()} prefill={prefill} />
    </>
  );
}
