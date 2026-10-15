"use client";

import dynamic from "next/dynamic";
import { OddPresaleSkeleton } from "./loading";

const OddPresaleContent = dynamic(() => import("./OddPresaleContent"), {
  ssr: false,
  loading: OddPresaleSkeleton,
});

export default function OddPresaleWrapper({ cloudSvg }: { cloudSvg: string }) {
  return <OddPresaleContent cloudSvg={cloudSvg} />;
}
