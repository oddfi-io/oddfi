"use client";

import dynamic from "next/dynamic";
import { LendSkeleton } from "./loading";

const LendingPage = dynamic(() => import("@/components/lending/LendingPage"), {
  ssr: false,
  loading: LendSkeleton,
});

export default function LendWrapper() {
  return <LendingPage />;
}
