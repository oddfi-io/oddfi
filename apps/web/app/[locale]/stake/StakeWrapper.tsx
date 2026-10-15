"use client";

import dynamic from "next/dynamic";
import { StakeSkeleton } from "./loading";

const StakingPage = dynamic(() => import("@/components/staking/StakingPage"), {
  ssr: false,
  loading: StakeSkeleton,
});

export default function StakeWrapper() {
  return <StakingPage />;
}
