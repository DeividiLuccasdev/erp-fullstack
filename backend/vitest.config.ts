import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Todos os arquivos usam o mesmo banco: um de cada vez
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      JWT_SECRET: process.env.JWT_SECRET ?? "segredo-dos-testes",
    },
  },
});
