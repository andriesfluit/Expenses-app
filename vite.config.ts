import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
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
