import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** Crea e pubblica una sessione compatta dedicata ai test end-to-end. */
export default function globalSetup() {
  mkdirSync("test-results", { recursive: true });
  const out = path.join("test-results", "e2e-session.json");
  execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/seed-demo.ts", "--e2e", out], {
    stdio: "inherit",
  });
}
