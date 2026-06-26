import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const certDir = path.resolve(__dirname, "../.dev/certs");
const useTls = process.env.VITE_DEV_TLS === "true";
const certPath = path.join(certDir, "lab.crt");
const keyPath = path.join(certDir, "lab.key");
const hasCerts =
  useTls && fs.existsSync(certPath) && fs.existsSync(keyPath);

const https = hasCerts
  ? {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }
  : undefined;

const backendTarget = hasCerts
  ? "https://127.0.0.1:8000"
  : "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    https,
    proxy: hasCerts
      ? {
          "/api": { target: backendTarget, secure: false, changeOrigin: true },
          "/ws": { target: backendTarget, ws: true, secure: false, changeOrigin: true },
          "/health": { target: backendTarget, secure: false, changeOrigin: true },
          "/docs": { target: backendTarget, secure: false, changeOrigin: true },
          "/openapi.json": { target: backendTarget, secure: false, changeOrigin: true },
        }
      : undefined,
  },
});
