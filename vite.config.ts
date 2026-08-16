import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serveert een project-repo onder /<repo>/, dus daar moeten de
  // asset-paden op aansluiten. Lokaal en bij een eigen domein blijft dit "/".
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    // true luistert op alle netwerkinterfaces, zodat de dev-server ook vanaf
    // een telefoon op hetzelfde wifi te openen is. Het oude "::" was
    // IPv6-only en faalt op machines zonder IPv6.
    host: true,
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
