import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => {
  const commonConfig: Options = {
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    minify: false,
    splitting: false,
    treeshake: false,
    target: "es2022",
    outDir: "dist",
    clean: false,
    outExtension({ format }) {
      return {
        js: format === "cjs" ? ".cjs" : ".js",
      };
    },
    external: [
      "react",
      "react-dom",
      "firebase",
      "firebase/auth",
      "@zolexora/utils",
    ],
  };

  return [
    // 1. Headless / Universal Entries (Root & Client)
    // Usable in Server Components, Server Actions, Route Handlers, and Node.js
    {
      ...commonConfig,
      entry: {
        index: "src/index.ts",
        client: "src/client/index.ts",
      },
    },
    // 2. React Client Components & Hooks (React & Turnstile)
    // Prepends "use client"; directive for Next.js 14/15 App Router compatibility
    {
      ...commonConfig,
      entry: {
        react: "src/react/index.ts",
        turnstile: "src/turnstile/index.ts",
        "public-sign-in": "src/public-sign-in/index.ts",
      },
      banner: {
        js: '"use client";',
      },
    },
  ];
});
