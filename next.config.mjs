/** @type {import('next').NextConfig} */
const nextConfig = {
  // The packages are plain TypeScript source, compiled by Next rather than pre-built.
  transpilePackages: ["@imprint/schema", "@imprint/store", "@imprint/graph"],
  // node:sqlite is a built-in; keep it external so it is required at runtime, not bundled.
  serverExternalPackages: ["node:sqlite"],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
