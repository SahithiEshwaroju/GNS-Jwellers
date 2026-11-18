import Link from "next/link";
export default function NotFound() {
  return (
    <div className="wrap py-20 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="mt-3 h-page">This design isn&apos;t available</h1>
      <p className="mt-3 text-muted">It may have been removed or the link is incorrect.</p>
      <Link href="/jewellery" className="btn btn-primary mt-6">Browse all jewellery</Link>
    </div>
  );
}
