import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true, // testing-library auto-cleanup 依赖全局 afterEach
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**",
      "**/.claude/hooks/**",
      // .progress 是 gitignored 草稿/文档区（stash/designs/bug…），不是测试根；
      // 临时排查用的孤儿 *.test.tsx 落这里不应进全量 suite 拦住 commit/push。
      "**/.progress/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
