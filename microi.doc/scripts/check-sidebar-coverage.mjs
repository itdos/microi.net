import fs from "node:fs";
import path from "node:path";

const docsRoot = path.resolve("docs");
const targets = [
  { label: "中文文档", root: "doc", mapping: "mapping_zh.json" },
  { label: "中文案例", root: "case", mapping: "mapping_zh.json" },
  { label: "English docs", root: "en/doc", mapping: "mapping_en.json" },
  { label: "English cases", root: "en/case", mapping: "mapping_en.json" },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function walkMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(fullPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

const failures = [];
let checked = 0;

for (const target of targets) {
  const root = path.join(docsRoot, target.root);
  const mapping = readJson(path.join(docsRoot, target.mapping));
  const mappedNames = new Set(Object.keys(mapping));
  const files = walkMarkdown(root);
  checked += files.length;

  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const missingSegments = relative
      .split("/")
      .filter((segment) => !mappedNames.has(segment));

    if (missingSegments.length) {
      failures.push(
        `${target.label}: ${target.root}/${relative} 缺少映射 ${missingSegments.join(", ")}`,
      );
    }
  }
}

if (failures.length) {
  console.error("Sidebar coverage failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Sidebar coverage passed: ${checked} Markdown pages are present in their locale mappings.`);
