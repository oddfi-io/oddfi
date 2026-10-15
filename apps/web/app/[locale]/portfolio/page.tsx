import PortfolioWrapper from "./PortfolioWrapper";
import { PortfolioImagePreloader } from "@/components/portfolio/PortfolioImagePreloader";

export default function PortfolioPage() {
  return (
    <>
      <PortfolioImagePreloader />
      <PortfolioWrapper />
    </>
  );
}
