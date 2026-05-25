import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Register the React plugin so JSX in .jsx files uses the automatic
// runtime (react/jsx-runtime). Without this, Vite falls back to esbuild's
// classic transform which emits `React.createElement(...)` and the bundle
// throws `ReferenceError: React is not defined` at runtime — the cause of
// the blank-page deploy.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    host: "0.0.0.0",
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
