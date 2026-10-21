/** @type {import('next').NextConfig} */
const nextConfig = {
  // No ESLint config yet; type errors still fail the build.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // The chat route reads the course materials from disk at runtime.
    outputFileTracingIncludes: { '/api/chat': ['./content/**/*'], '/api/materials': ['./content/**/*'] },
  },
}
module.exports = nextConfig
