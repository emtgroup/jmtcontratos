import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version?: string;
};

function readGitMetadata() {
  try {
    const commitSha = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    const commitDateIso = execSync("git show -s --format=%cI HEAD", { encoding: "utf-8" }).trim();

    return {
      commitSha: commitSha || undefined,
      commitDateIso: commitDateIso || undefined,
    };
  } catch {
    return {
      commitSha: undefined,
      commitDateIso: undefined,
    };
  }
}

const gitMetadata = readGitMetadata();
const appVersion = packageJson.version || "0.0.0";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT_SHA__: JSON.stringify(gitMetadata.commitSha ?? null),
    __APP_COMMIT_DATE_ISO__: JSON.stringify(gitMetadata.commitDateIso ?? null),
  },
}));
