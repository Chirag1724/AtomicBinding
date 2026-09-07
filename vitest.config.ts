import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@imprint/schema": resolve(__dirname, "packages/schema/src/index.ts"),
      "@imprint/store": resolve(__dirname, "packages/store/src/index.ts"),
      "@imprint/graph": resolve(__dirname, "packages/graph/src/index.ts"),
      "~/schema": resolve(__dirname, "schema/index.ts"),
      "@": resolve(__dirname, "src"),
    },
  },
});
