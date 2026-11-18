"use client";
export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap py-20 text-center">
      <h1 className="h-page">Something went wrong</h1>
      <p className="mt-3 text-muted">Please try again in a moment.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">Try again</button>
    </div>
  );
}
