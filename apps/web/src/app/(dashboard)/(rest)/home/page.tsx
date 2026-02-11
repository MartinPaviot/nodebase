"use client";

import { Suspense } from "react";
import { HomeContent } from "@/features/agents/components/home-content";

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  return (
    <div className="flex-1 overflow-auto">
      {/* Inner wrapper - gradient positioned relative to this */}
      <div className="relative">
        {/* Cool Blue/Lavender mesh gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg,
                rgba(219, 234, 254, 0.5) 0%,
                rgba(224, 231, 255, 0.35) 20%,
                rgba(241, 245, 249, 0.25) 40%,
                rgba(248, 250, 252, 0.15) 60%,
                rgba(255, 255, 255, 0.05) 80%,
                transparent 100%
              )`
            }}
          />
          <div
            className="absolute -top-40 -left-40 w-[1000px] h-[1000px] rounded-full blur-[120px]"
            style={{
              background: `radial-gradient(ellipse at center,
                rgba(196, 181, 253, 0.35) 0%,
                rgba(221, 214, 254, 0.2) 40%,
                transparent 70%
              )`
            }}
          />
          <div
            className="absolute -top-20 -right-60 w-[900px] h-[900px] rounded-full blur-[120px]"
            style={{
              background: `radial-gradient(ellipse at center,
                rgba(186, 230, 253, 0.35) 0%,
                rgba(207, 250, 254, 0.2) 40%,
                transparent 70%
              )`
            }}
          />
        </div>
        {/* Spacer for header area */}
        <div className="h-48 relative z-[1]" />

        <div className="max-w-4xl mx-auto px-6 -mt-32 relative z-[1]">
        {/* Title skeleton */}
        <div className="h-10 w-64 bg-muted rounded-lg mx-auto mb-8 animate-pulse" />

        {/* Input skeleton */}
        <div className="h-24 bg-card rounded-2xl border shadow-sm mb-6 animate-pulse" />

        {/* Suggestions skeleton */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-8 w-32 bg-muted rounded-full animate-pulse" />
          ))}
        </div>

        {/* Categories skeleton */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-24 bg-muted rounded-full animate-pulse" />
          ))}
        </div>

        {/* Templates skeleton */}
        <div className="space-y-12">
          {[1, 2].map((section) => (
            <div key={section}>
              <div className="h-6 w-32 bg-muted rounded mb-4 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 h-40 bg-muted rounded-xl animate-pulse" />
                <div className="h-40 bg-muted rounded-xl animate-pulse" />
                <div className="h-24 bg-muted rounded-xl animate-pulse" />
                <div className="h-24 bg-muted rounded-xl animate-pulse" />
                <div className="h-24 bg-muted rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>{/* Close inner wrapper */}
    </div>
  );
}
