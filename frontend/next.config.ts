import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next.js only serves dev assets to localhost by default; without this the page does not
  // hydrate when opened as http://127.0.0.1:3000.
  allowedDevOrigins: ['127.0.0.1'],
  // The browser only ever talks to this origin; /api is proxied to the Express server, which
  // keeps the session cookie first-party and removes the need for CORS.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
