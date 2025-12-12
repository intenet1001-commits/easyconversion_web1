/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 프로덕션 빌드 시 별도 디렉토리 사용 (dev 서버와 충돌 방지)
  distDir: process.env.NODE_ENV === 'production' ? '.next-prod' : '.next',
  experimental: {
    // 대용량 파일 업로드를 위한 body size 제한 (50GB)
    serverActions: {
      bodySizeLimit: '50gb',
    },
  },
  webpack: (config, { isServer }) => {
    // Suppress Handlebars warnings for html-pdf-node
    config.ignoreWarnings = [
      { module: /node_modules\/handlebars\/lib\/index\.js/ },
    ];
    return config;
  },
}

module.exports = nextConfig
