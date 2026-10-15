import {
  TopNavShell,
  WrongNetworkBannerShell,
  AIAgentFloatShell,
  AiChatModalShell,
  AgentGlobalOnboardingShell,
} from "@/components/layout/LayoutShell";
import LocatorSetup from "@/components/ui/LocatorSetup";
import ThemeScript from "@/components/theme/ThemeScript";
import type { Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import Toaster from "@/components/ui/Toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";
import { Providers } from "../providers";
import { anton, notoSansSC, orbitron, poppins, racingSansOne } from "../fonts";
import { EarlyBirdProvider } from "@/components/early-bird/EarlyBirdProvider";
import {
  IS_EARLY_BIRD_MODE,
  EB_BYPASS_COOKIE,
  isEarlyBirdBypassValid,
} from "@/lib/early-bird-mode";

const BASE_URL = "https://www.oddfi.io";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    metadataBase: new URL(BASE_URL),
    title: {
      template: "OddFi · %s",
      default: `OddFi · ${t("siteTitle")}`,
    },
    description: t("description"),
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${BASE_URL}/${l}/home`])),
        "x-default": `${BASE_URL}/en/home`,
      },
    },
    openGraph: {
      title: "OddFi — World Cup 2026 Crypto Sportsbook",
      description: t("description"),
      url: `${BASE_URL}/${locale}/home`,
      images: [{ url: "/images/og-image.png", width: 1200, height: 630 }],
      siteName: "OddFi",
    },
    twitter: {
      card: "summary_large_image",
      images: ["/images/og-image.png"],
    },
    manifest: "/manifest.json",
    verification: {
      google: "jFuxNp7k39at2CaAVl35Apyr58we_M390rANVeb5fTU",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#04060c",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 校验 locale 合法性
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  // DD-103 续：bypass cookie 仅在早鸟模式下读取，httpOnly + 值=INVITE_CODE 原文校验。
  const earlyBirdBypass = IS_EARLY_BIRD_MODE
    ? isEarlyBirdBypassValid((await cookies()).get(EB_BYPASS_COOKIE)?.value)
    : false;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${orbitron.variable} ${poppins.variable} ${notoSansSC.variable} ${anton.variable} ${racingSansOne.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans text-primary antialiased min-h-screen bg-primary">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <EarlyBirdProvider bypass={earlyBirdBypass}>
              <LocatorSetup />
              <TopNavShell />
              <div className="pt-[64px] lg:pt-[64px]">
                <WrongNetworkBannerShell />
                {children}
              </div>
              <AIAgentFloatShell />
              <AiChatModalShell />
              <AgentGlobalOnboardingShell />
              <Toaster />
              <SpeedInsights />
              <Analytics />
            </EarlyBirdProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
