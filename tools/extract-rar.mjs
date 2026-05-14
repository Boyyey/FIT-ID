import fs from "node:fs";
import path from "node:path";
import { createExtractorFromData } from "node-unrar-js";

function usage() {
  console.log("Usage: node tools/extract-rar.mjs <archive.rar> <outDir>");
}

const [, , rarPathRaw, outDirRaw] = process.argv;
if (!rarPathRaw || !outDirRaw) {
  usage();
  process.exit(1);
}

const rarPath = path.resolve(rarPathRaw);
const outDir = path.resolve(outDirRaw);
if (!fs.existsSync(rarPath)) {
  console.error("Archive not found:", rarPath);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const data = fs.readFileSync(rarPath);
const extractor = createExtractorFromData(data);
const list = extractor.getFileList();
if (list[0].state !== "SUCCESS") {
  console.error("Failed to read rar file list:", list[0].reason);
  process.exit(1);
}

const entries = list[1].fileHeaders.filter((h) => !h.flags.directory);
console.log("Entries:", entries.length);

const extracted = extractor.extract({ files: entries.map((e) => e.name) });
if (extracted[0].state !== "SUCCESS") {
  console.error("Extraction failed:", extracted[0].reason);
  process.exit(1);
}

for (const f of extracted[1].files) {
  const p = path.join(outDir, f.fileHeader.name);
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, Buffer.from(f.extraction));
}

console.log("Done:", outDir);

