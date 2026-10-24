import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't write AGENTS.md into the project on `next dev`
  agentRules: false,
  // linkedom / readability are server-only and should not be bundled for the client
  serverExternalPackages: ["linkedom", "@mozilla/readability"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
