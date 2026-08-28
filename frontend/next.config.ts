import type { NextConfig } from "next";

const staticExport = process.env.HISAAB_STATIC_EXPORT === "1";
const nextConfig: NextConfig = {
  transpilePackages: ["@hisaab/ui", "@hisaab/types", "@hisaab/validation"],
  experimental: {
    cpus: 1,
    optimizePackageImports: ["lucide-react", "recharts"],
    useTypeScriptCli: false,
  },
  ...(staticExport ? { output: "export" as const } : {}),
};
export default nextConfig;
