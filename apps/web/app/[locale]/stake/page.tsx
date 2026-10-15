// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
import { getTranslations } from "next-intl/server";
import StakeWrapper from "./StakeWrapper";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("pages.stake") };
}

export default function StakeRoute() {
  return <StakeWrapper />;
}
