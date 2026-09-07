import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { skillsFromExtractedRoot } from "./github.js";

/**
 * ZIP source: discover skills inside a local .zip archive.
 *
 * Zero-dependency reader: parses the End Of Central Directory record and the
 * central directory, then inflates entries with zlib. Supports the two methods
 * every archiver emits for text bundles: store (0) and deflate (8). Multi-disk
 * archives, encryption and ZIP64 are rejected explicitly.
 *
 * Extraction is zip-slip safe: absolute paths, drive letters and `..` segments
 * are refused before anything touches disk.
 */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** List central-directory entries of a zip buffer: [{name, method, size, offset}]. */
export function listZipEntries(buf) {
  // EOCD lives in the last 64KiB + 22 bytes; scan backwards for its signature.
  const min = Math.max(0, buf.length - 22 - 65536);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip archive (no end-of-central-directory)");
  const diskNo = buf.readUInt16LE(eocd + 4);
  if (diskNo !== 0) throw new Error("multi-disk zip archives are not supported");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) throw new Error("corrupt central directory");
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    if (size === 0xffffffff || compSize === 0xffffffff) throw new Error("ZIP64 archives are not supported");
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8");
    const offset = buf.readUInt32LE(p + 42);
    entries.push({ name, method, size, compSize, crc, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntryData(buf, entry) {
  const p = entry.offset;
  if (buf.readUInt32LE(p) !== LOC_SIG) throw new Error(`corrupt local header for ${entry.name}`);
  const flags = buf.readUInt16LE(p + 6);
  if (flags & 1) throw new Error(`encrypted entry not supported: ${entry.name}`);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  // Sizes come from the central directory: with the data-descriptor flag (bit 3)
  // the local header carries zeros.
  const raw = buf.slice(start, start + entry.compSize);
  const data = entry.method === 0 ? raw : entry.method === 8 ? inflateRawSync(raw) : null;
  if (data === null) throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`);
  if (data.length !== entry.size) throw new Error(`size mismatch for ${entry.name}`);
  if (crc32(data) !== entry.crc) throw new Error(`crc mismatch for ${entry.name}`);
  return data;
}

/** Zip-slip guard: resolve an entry name to a safe path inside destDir, or null to refuse. */
function safeJoin(destDir, name) {
  // Treat both separators as path boundaries on every platform: a backslash
  // "..\evil" segment is inert on POSIX but dangerous if the extraction is
  // later used on Windows.
  const norm = name.replace(/\\/g, "/");
  if (norm.startsWith("/") || /^[a-zA-Z]:/.test(norm)) return null;
  const parts = norm.split("/").filter(p => p !== "." && p !== "");
  if (parts.includes("..")) return null;
  return join(destDir, ...parts);
}

/**
 * Extract a zip file into destDir (created if missing). Returns { ok, files } —
 * files are the paths written, relative to destDir. Throws on corrupt archives.
 */
export function extractZip(zipPath, destDir) {
  const buf = readFileSync(zipPath);
  const entries = listZipEntries(buf);
  const files = [];
  mkdirSync(destDir, { recursive: true });
  for (const e of entries) {
    if (e.name.endsWith("/")) continue; // directory marker
    const target = safeJoin(destDir, e.name);
    if (!target) throw new Error(`unsafe path in zip: ${e.name}`);
    const data = readEntryData(buf, e);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, data);
    files.push(e.name.replace(/\\/g, "/"));
  }
  return { ok: true, files };
}

/**
 * Default extraction dir for a zip path: per-path + per-content temp dir.
 * The mtime participates in the key, so a changed zip is re-extracted instead
 * of being served stale.
 */
export function zipWorkDir(zipPath) {
  let tag = zipPath;
  try { tag += `@${statSync(zipPath).mtimeMs}`; } catch { /* missing file: path-only key */ }
  return join(tmpdir(), `skill-fusion-zip-${crc32(Buffer.from(tag)).toString(16)}`);
}

/**
 * Discover skills inside a local zip archive. Extracts once into workDir
 * (default: zipWorkDir(zipPath)) and reuses the extraction on repeat calls.
 *
 * @param {string} zipPath - path to the .zip file
 * @param {object} opts - { workDir } injectable extraction root (testing)
 * @returns {Array} candidates with sourceKind="zip"
 */
export function discoverZip(zipPath, { workDir } = {}) {
  if (!existsSync(zipPath)) return [];
  const dir = workDir || zipWorkDir(zipPath);
  if (!existsSync(dir)) extractZip(zipPath, dir);
  return skillsFromExtractedRoot(dir, { sourceKind: "zip", sourceRef: zipPath });
}
