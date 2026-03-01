"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h2 className="text-xl font-semibold text-rose-800">Something went wrong</h2>
        <p className="mt-2 text-sm text-rose-700">Please retry your request.</p>
      </div>
    </main>
  );
}
