import Image from "next/image";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-80px)] px-4 text-center">
      <Image
        src="/images/logo-icon.svg"
        alt="OddFi"
        width={48}
        height={48}
        sizes="48px"
        className="mb-6 opacity-30"
      />
      <h1 className="text-[80px] font-bold text-primary leading-none mb-2">404</h1>
      <p className="text-secondary text-sm mb-8">Page not found</p>
      <Link
        href="/markets"
        className="inline-flex items-center justify-center rounded-full font-semibold text-sm px-6 min-h-[44px] bg-btn-primary hover:bg-btn-primary-hover active:bg-btn-primary-press transition-all duration-150 text-static-black"
      >
        Back to Markets
      </Link>
    </div>
  );
}
