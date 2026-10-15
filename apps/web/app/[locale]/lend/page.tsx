import { getTranslations } from "next-intl/server";
import LendWrapper from "./LendWrapper";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("pages.lend") };
}

export default function LendRoute() {
  return <LendWrapper />;
}
