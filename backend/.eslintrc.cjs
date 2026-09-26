/**
 * FN-07: backend previously had `npm run lint` wired to eslint but no eslint
 * dependency or config, so it always failed ("eslint: not found"). This is a
 * lean, correctness-focused config (not a style overhaul): the TypeScript build
 * (tsc, strict + noUnusedLocals) already covers types/unused code, so eslint
 * here catches likely-bug patterns. Opinionated rules that would demand a
 * repo-wide rewrite are relaxed to warnings so `npm run lint` stays green
 * (exit 0) while still surfacing them.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  ignorePatterns: ["dist/", "node_modules/", "scripts/"],
  rules: {
    // tsc already enforces these more precisely; avoid duplicate/false errors.
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    // The codebase intentionally uses `any`/`!` at Supabase boundaries (documented).
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
  },
  overrides: [
    {
      files: ["**/*.test.ts", "src/test-support/**"],
      env: { node: true },
      rules: { "@typescript-eslint/no-explicit-any": "off" },
    },
  ],
};
