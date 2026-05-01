/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    'formidable', 'pdf-lib', 'pdf-parse',
    'archiver', 'archiver-utils',
    'mammoth', 'jszip',
    'docx', 'xlsx',
    'html-pdf-node', 'puppeteer',
    'tesseract.js', 'pdf-img-convert',
  ],
  transpilePackages: ['@radix-ui/react-compose-refs', '@radix-ui/react-collection', '@radix-ui/react-roving-focus', '@radix-ui/react-tabs'],
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  outputFileTracingRoot: require('path').join(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: '50gb',
    },
  },
  webpack: (config, { isServer }) => {
    config.ignoreWarnings = [
      { module: /node_modules\/handlebars\/lib\/index\.js/ },
    ];
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)), '@opentelemetry/api'];
    }
    return config;
  },
}

module.exports = nextConfig
