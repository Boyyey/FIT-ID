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
const extractor = await createExtractorFromData({ data: data.buffer });

const list = extractor.getFileList();
const headers = Array.from(list.fileHeaders);
const files = headers.filter((h) => !h.flags.directory);
console.log("Entries:", files.length);

const extracted = extractor.extract({ files: (h) => !h.flags.directory });
for (const f of extracted.files) {
  if (!f.extraction) continue;
  const p = path.join(outDir, f.fileHeader.name);
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, Buffer.from(f.extraction));
}

console.log("Done:", outDir);

