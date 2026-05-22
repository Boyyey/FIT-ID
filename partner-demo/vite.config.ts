import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  },

  server: {
    port: 5174,
    strictPort: true,
    allowedHosts: ["luma-artier.onrender.com"]
  },

  preview: {
    host: "0.0.0.0",
    port: process.env.PORT || 4173,
    allowedHosts: ["luma-artier.onrender.com"]
  }
});
