import Link from "next/link";
import { ArrowLeftCircle, Compass } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-black via-gray-950 to-black px-6 py-16 text-white">
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <div className="relative">
          <Compass className="h-20 w-20 text-white/60" />
          <span className="absolute inset-0 animate-pulse rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-white/50">Error 404</p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            This page lives off the dashboard map
          </h1>
          <p className="text-base text-white/70 sm:text-lg">
            The link you followed isn&apos;t part of the main navigation. Let&apos;s head back to the dashboard where all the action is happening.
          </p>
        </div>
        <Button asChild className="gap-2 rounded-full px-6 py-5 text-base font-semibold">
          <Link href="/">
            <ArrowLeftCircle className="h-5 w-5" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
