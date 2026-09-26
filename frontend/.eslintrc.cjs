/**
 * FN-07: frontend had the eslint toolchain in devDependencies but no config
 * file, so `npm run lint` failed ("couldn't find a configuration file"). Lean,
 * correctness-focused config; `tsc -b` already covers types. Opinionated rules
 * that would need a broad rewrite are warnings so `npm run lint` stays green.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  env: { browser: true, es2022: true },
  ignorePatterns: ["dist/", "node_modules/", "vendor/", "*.config.ts", "*.config.js"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "src/test-setup.ts"],
      env: { browser: true },
    },
  ],
};
