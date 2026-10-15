import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE_URL = "https://www.oddfi.io";

const staticRoutes = ["/home", "/odd-presale"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const route of staticRoutes) {
      entries.push({
        url: `${BASE_URL}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === "/home" ? "daily" : "weekly",
        priority: route === "/home" ? 1.0 : 0.8,
      });
    }
  }

  return entries;
}
