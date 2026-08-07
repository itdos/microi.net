import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve();
const docsRoot = path.join(projectRoot, "docs");
const giteePattern = /https:\/\/gitee\.com\/ITdos\/microi\.net/gi;
const githubPattern = /https:\/\/github\.com\/itdos\/microi\.net/gi;
const failures = [];

function walkMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(fullPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

for (const file of walkMarkdown(docsRoot)) {
  if (file.endsWith(path.join("about", "update-log.md"))) continue;
  const source = fs.readFileSync(file, "utf8");
  const giteeCount = source.match(giteePattern)?.length ?? 0;
  const githubCount = source.match(githubPattern)?.length ?? 0;
  if (giteeCount > githubCount) {
    failures.push(
      `${path.relative(projectRoot, file)}: Gitee ${giteeCount}, GitHub ${githubCount}`,
    );
  }
}

for (const relative of [
  "docs/.vitepress/config/shared.ts",
  "docs/.vitepress/config/zh.ts",
  "docs/.vitepress/config/en.ts",
]) {
  const source = fs.readFileSync(path.join(projectRoot, relative), "utf8");
  if (!source.includes('icon: "github"') || !githubPattern.test(source)) {
    failures.push(`${relative}: 缺少 GitHub 社交图标或仓库链接`);
  }
  githubPattern.lastIndex = 0;
}

const themeStyle = fs.readFileSync(
  path.join(projectRoot, "docs/.vitepress/theme/styles/index.scss"),
  "utf8",
);
if (!themeStyle.includes(".VPNavBarExtra .group:has(> .item.appearance)")) {
  failures.push("docs/.vitepress/theme/styles/index.scss: 未移除桌面更多菜单中的重复 Appearance");
}

if (failures.length) {
  console.error("Open-source link contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Open-source link contract passed: GitHub accompanies maintained Gitee repository references.");
