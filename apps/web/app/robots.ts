import type { MetadataRoute } from "next";

const BASE_URL = "https://www.oddfi.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/access"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
