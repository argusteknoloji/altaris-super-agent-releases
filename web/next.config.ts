import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" }
  },
  env: {
    ALTARIS_API_BASE: process.env.ALTARIS_API_BASE ?? "http://localhost:5000"
  }
};

export default config;
