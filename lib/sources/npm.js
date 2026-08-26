import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REGISTRY = "https://registry.npmjs.org";

export async function discoverNpm(name, { fetchFn = globalThis.fetch } = {}) {
  const url = `${REGISTRY}/${encodeURIComponent(name)}/latest`;
  let res;
  try { res = await fetchFn(url); } catch { return null; }
  if (!res?.ok) return null;
  const pkg = await res.json();
  if (!pkg?.name || !pkg?.version) return null;

  // Detect skills: check files array for skills/ entries
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  const skillDirs = files
    .filter(f => f.startsWith("skills/") && f.endsWith("/"))
    .map(f => ({ name: f.replace(/^skills\//, "").replace(/\/$/, ""), fetchPath: f }));
  if (skillDirs.length === 0) {
    // Fallback: check if description/keywords suggest a skill
    const desc = (pkg.description || "").toLowerCase();
    if (!desc.includes("skill")) return null;
    skillDirs.push({ name: pkg.name, fetchPath: null });
  }

  return {
    name: pkg.name,
    description: pkg.description || "",
    version: pkg.version,
    sourceKind: "npm",
    sourceRef: `${pkg.name}@${pkg.version}`,
    tarballUrl: pkg.dist?.tarball || null,
    skills: skillDirs,
  };
}

export async function fetchTarball(url, destDir, { fetchFn = globalThis.fetch } = {}) {
  let res;
  try { res = await fetchFn(url); } catch (e) { return { ok: false, error: String(e) }; }
  if (!res?.ok) return { ok: false, error: `fetch failed: ${res?.status}` };
  try {
    mkdirSync(destDir, { recursive: true });
    const buf = Buffer.from(await res.arrayBuffer());
    const tgzPath = join(destDir, "package.tgz");
    writeFileSync(tgzPath, buf);
    // Extract with tar (system tool, no npm dep)
    execFileSync("tar", ["xzf", tgzPath, "-C", destDir], { stdio: "pipe" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
