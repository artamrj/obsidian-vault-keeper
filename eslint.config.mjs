import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["main.js", "node_modules/**"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["Finder", "Explorer", "Obsidian", "Vault Keeper"],
        },
      ],
    },
  },
  {
    files: ["src/main.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
]);
