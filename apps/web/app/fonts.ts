import { Anton, Noto_Sans_SC, Orbitron, Poppins, Racing_Sans_One } from "next/font/google";

export const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-orbitron",
  display: "swap",
});

export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-poppins",
  display: "swap",
});

export const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sc",
  display: "swap",
});

export const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
  display: "fallback",
});

export const racingSansOne = Racing_Sans_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-racing",
  display: "fallback",
});
