import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import pluginSecurity from "eslint-plugin-security";
import pluginNoSecrets from "eslint-plugin-no-secrets";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "prisma/**",
    "src/generated/**",
  ]),
  // Security rules
  {
    plugins: {
      security: pluginSecurity,
      "no-secrets": pluginNoSecrets,
    },
    rules: {
      ...pluginSecurity.configs.recommended.rules,
      "no-secrets/no-secrets": ["error", { tolerance: 4.2 }],
    },
  },
]);

export default eslintConfig;
