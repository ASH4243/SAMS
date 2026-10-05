"use strict";

const js = require("@eslint/js");
const react = require("eslint-plugin-react");

const nodeGlobals = {
  Buffer: "readonly",
  __dirname: "readonly",
  console: "readonly",
  exports: "readonly",
  module: "readonly",
  process: "readonly",
  require: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};
const browserGlobals = {
  Event: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  URLSearchParams: "readonly",
  console: "readonly",
  document: "readonly",
  fetch: "readonly",
  window: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  confirm: "readonly",
  alert: "readonly",
};

module.exports = [
  { ignores: ["node_modules/**", "client/dist/**"] },
  {
    files: ["server/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["client/src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...browserGlobals,
        Intl: "readonly",
        Date: "readonly",
        Math: "readonly",
        Number: "readonly",
        String: "readonly",
        Object: "readonly",
        Array: "readonly",
        Set: "readonly",
        Map: "readonly",
        Error: "readonly",
        Promise: "readonly",
        Boolean: "readonly",
        JSON: "readonly",
        localStorage: "readonly",
        afterEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        vi: "readonly",
      },
    },
    plugins: { react },
    rules: {
      ...js.configs.recommended.rules,
      "react/jsx-uses-vars": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
