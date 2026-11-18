export default function Loading() {
  return (
    <div className="wrap py-10" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-10 w-64" />
      <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4]" />)}
      </div>
    </div>
  );
}
