import { mkdtempSync, mkdirSync, symlinkSync, lstatSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let cached;

/**
 * Probe whether directory symlinks actually work on this machine
 * (false on unprivileged Windows, where activateSkill falls back to copy).
 * Result is probed once per process and cached.
 */
export function symlinkSupported() {
  if (cached !== undefined) return cached;
  const dir = mkdtempSync(join(tmpdir(), "sf-link-probe-"));
  const src = join(dir, "src");
  mkdirSync(src);
  try {
    symlinkSync(src, join(dir, "link"), "dir");
    cached = lstatSync(join(dir, "link")).isSymbolicLink();
  } catch {
    cached = false;
  }
  rmSync(dir, { recursive: true, force: true });
  return cached;
}

/** The mode activateSkill will report for a real directory source on this host. */
export function expectedDirMode() {
  return symlinkSupported() ? "symlink" : "copy";
}
