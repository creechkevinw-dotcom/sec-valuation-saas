import { LoadingSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <LoadingSkeleton />
    </main>
  );
}
