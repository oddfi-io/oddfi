import ContentTypeTabs from "@/components/game-markets/ContentTypeTabs";
import { MarketsToolbarSkeleton } from "@/components/game-markets/MarketsToolbar";
import { TimelineSkeleton } from "@/components/game-markets/MatchList";

/**
 * Next.js Suspense fallback for /markets page.
 * Renders ONLY the main content area — sidebar is handled by layout.tsx.
 * Container className mirrors MarketsPageClient <main>.
 */
export default function MarketsLoading() {
  return (
    <main className="min-w-0 px-4 pb-4 pt-0 lg:px-6 lg:pb-6 lg:pt-0 lg:h-full lg:overflow-hidden">
      <div className="flex flex-col gap-4">
        <ContentTypeTabs />
        <MarketsToolbarSkeleton />
        <TimelineSkeleton />
      </div>
    </main>
  );
}
