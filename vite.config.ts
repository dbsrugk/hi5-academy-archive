import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "next/image", replacement: path.resolve(__dirname, "src/shims/next-image.tsx") },
      { find: "next-themes", replacement: path.resolve(__dirname, "src/shims/next-themes.tsx") },
      { find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" },
    ],
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: { outDir: "dist", assetsDir: "assets", cssCodeSplit: false, chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { entryFileNames: "assets/app.js", assetFileNames: "assets/[name][extname]", inlineDynamicImports: true } } },
});
