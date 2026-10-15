import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": new URL("./src/domain", import.meta.url).pathname,
      "@application": new URL("./src/application", import.meta.url).pathname,
      "@infrastructure": new URL("./src/infrastructure", import.meta.url).pathname,
      "@interface": new URL("./src/interface", import.meta.url).pathname,
      "@shared": new URL("./src/shared", import.meta.url).pathname
    }
  },
  test: {
    environment: "node",
    globals: false,
    exclude: ["**/node_modules/**", "**/.git/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  }
});
