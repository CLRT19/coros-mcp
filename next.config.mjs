/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.coros.com" },
      { protocol: "https", hostname: "s3.coros.com" },
    ],
  },
};

export default nextConfig;
