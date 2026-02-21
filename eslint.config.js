import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
    {
        ignores: ["dist/", "examples/", "coverage/", "node_modules/"],
    },

    js.configs.recommended,

    ...tseslint.configs.recommended,

    prettierConfig,

    {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
);
