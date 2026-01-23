import alchemy from "alchemy";
import { Astro, TanStackStart } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("echo");

export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  bindings: {
    VITE_CONVEX_URL: alchemy.env.VITE_CONVEX_URL!,
    VITE_CONVEX_SITE_URL: alchemy.env.VITE_CONVEX_SITE_URL!,
  },
});

export const marketing = await Astro("marketing", {
  cwd: "../../apps/marketing",
  output: "server",
  entrypoint: "dist/_worker.js/entry.mjs",
});

console.log(`Web       -> ${web.url}`);
console.log(`Marketing -> ${marketing.url}`);

await app.finalize();
