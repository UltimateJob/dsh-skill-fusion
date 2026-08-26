import { skillFusionRoutes } from "./routes.js";
import { join } from "node:path";
import { homedir } from "node:os";

export const name = "skill-fusion";
export const inject = ["webServer"];

export function apply(ctx) {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const routes = skillFusionRoutes(dshHome);
  try {
    ctx.effect(() => {
      const disposers = [];
      for (const route of routes) disposers.push(ctx.webServer.register(route));
      return () => { for (const d of disposers) d(); };
    }, "skill-fusion: routes");
  } catch (error) {
    console.error("[skill-fusion] route registration failed:", error);
  }
}
