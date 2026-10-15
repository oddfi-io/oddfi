import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("aiAgent") };
}

export default function AiAgentLayout({ children }: { children: ReactNode }) {
  return children;
}
