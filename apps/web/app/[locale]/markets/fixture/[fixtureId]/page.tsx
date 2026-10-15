import type { SportmonksFixture } from "@/types/api";
import FixtureDetailWrapper from "./FixtureDetailWrapper";
import { MARKET_API_BASE } from "@/lib/market-api";

const MARKET_API_URL = MARKET_API_BASE;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; fixtureId: string }>;
}) {
  const { fixtureId: rawId } = await params;
  const fixtureId = Number(rawId);
  if (isNaN(fixtureId)) return {};

  try {
    const res = await fetch(`${MARKET_API_URL}/api/v1/detail/fixture/${fixtureId}?type=preview`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { data?: SportmonksFixture[] };
    const fixture = data.data?.[0];
    if (!fixture) return {};
    const home = fixture.participants?.find((p) => p.meta.location === "home");
    const away = fixture.participants?.find((p) => p.meta.location === "away");
    if (home && away) return { title: `${home.name} vs ${away.name}` };
  } catch {
    /* fallback to template default */
  }
  return {};
}

export default async function FixtureDetailPage({
  params,
}: {
  params: Promise<{ locale: string; fixtureId: string }>;
}) {
  const { fixtureId: rawId } = await params;
  const fixtureId = Number(rawId);

  if (isNaN(fixtureId)) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        <div className="rounded-8 px-6 py-10 text-center text-secondary text-sm bg-fill-modal border border-divider">
          Invalid fixture ID.
        </div>
      </div>
    );
  }

  return <FixtureDetailWrapper fixtureId={fixtureId} />;
}
