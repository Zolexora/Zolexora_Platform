module.exports = {
  extends: ["eslint:recommended"],
  env: {
    node: true,
    browser: true,
    es2022: true
  },
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2022
  },
  rules: {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
};
