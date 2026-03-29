import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure Next.js compiles TypeScript files from packages/shared
  // (imported via relative paths e.g. ../../../../packages/shared/...)
  transpilePackages: [],
  // Allow imports from the monorepo packages directory
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
