const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@knowledge': path.join(__dirname, '..', 'data', 'knowledge'),
    };
    return config;
  },
};

module.exports = nextConfig;
