const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.1.26'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

module.exports = nextConfig;