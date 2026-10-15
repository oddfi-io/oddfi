import LandingPage from "@/components/landing/LandingPage";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";

const BASE_URL = "https://www.oddfi.io";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: { absolute: "OddFi — World Cup 2026 Onchain Betting" },
    description:
      "Bet on 2026 FIFA World Cup matches with crypto. Transparent odds, instant settlement on BNB Chain.",
    alternates: {
      canonical: `${BASE_URL}/${locale}/home`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${BASE_URL}/${l}/home`])),
        "x-default": `${BASE_URL}/en/home`,
      },
    },
    openGraph: {
      title: "OddFi — World Cup 2026 Onchain Betting",
      description:
        "Bet on 2026 FIFA World Cup matches with crypto. Transparent odds, instant settlement on BNB Chain.",
      url: `${BASE_URL}/${locale}/home`,
      images: [{ url: "/images/og-image.png", width: 1200, height: 630 }],
    },
  };
}

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "OddFi",
  url: BASE_URL,
  description: "Onchain sports prediction platform for World Cup 2026",
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "OddFi",
  url: BASE_URL,
  logo: `${BASE_URL}/images/logo-icon.svg`,
  sameAs: ["https://twitter.com/OddFiOfficial", "https://t.me/oddfi"],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(orgSchema).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage />
    </>
  );
}
