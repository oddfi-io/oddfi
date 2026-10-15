"use client";

import dynamic from "next/dynamic";

const FixtureDetailClient = dynamic(() => import("./FixtureDetailClient"), {
  ssr: false,
  loading: () => (
    <div className="max-w-3xl mx-auto p-4 lg:p-6">
      <div className="animate-pulse rounded-8 bg-fill-modal h-[400px]" />
    </div>
  ),
});

export default function FixtureDetailWrapper({ fixtureId }: { fixtureId: number }) {
  return <FixtureDetailClient fixtureId={fixtureId} />;
}
