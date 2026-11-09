import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is opened from other machines on the LAN for local duels.
  // Production builds ignore this option.
  allowedDevOrigins: ["**"],
};

export default nextConfig;
