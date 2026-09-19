/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Qoder SDK spawns a qodercli child process; keep it external to the bundle.
  // (SQLite uses the built-in node:sqlite — no native package needed.)
  serverExternalPackages: ['@qodercn-ai/qodercn-agent-sdk'],
};

export default nextConfig;
