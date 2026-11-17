import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: [
    '192.168.1.3',
    '192.168.1.9',
    '192.168.*',
    '10.*',
    '*.local',
    'localhost',
  ],
};

export default nextConfig;
