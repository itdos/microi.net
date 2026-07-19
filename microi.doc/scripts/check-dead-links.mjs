import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMarkdownRenderer } from "vitepress";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const srcDir = path.join(projectRoot, "docs");
const publicDir = path.join(srcDir, "public");
const ignoredDirectories = new Set([".vitepress", ".tmp", "public"]);

const knownAssetExtensions = new Set(
  (
    "3g2,3gp,aac,ai,apng,au,avif,bin,bmp,cer,class,conf,crl,css,csv,dll,doc," +
    "eps,epub,exe,gif,gz,ics,ief,jar,jpe,jpeg,jpg,js,json,jsonld,m4a,man,mid," +
    "midi,mjs,mov,mp2,mp3,mp4,mpe,mpeg,mpg,mpp,oga,ogg,ogv,ogx,opus,otf," +
    "p10,p7c,p7m,p7s,pdf,png,ps,qt,roff,rtf,rtx,ser,svg,t,tif,tiff,tr,ts," +
    "tsv,ttf,txt,vtt,wav,weba,webm,webp,woff,woff2,xhtml,xml,yaml,yml,zip"
  ).split(","),
);

function slash(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isPageLink(pathname) {
  const extension = pathname.split(".").pop();
  return extension == null || !knownAssetExtensions.has(extension.toLowerCase());
}

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolutePath);
    }
  }

  return files;
}

const markdownFiles = await collectMarkdownFiles(srcDir);
const pages = new Set(
  markdownFiles.map((file) =>
    slash(path.relative(srcDir, file)).replace(/\.md$/, ""),
  ),
);
const markdown = await createMarkdownRenderer(srcDir, { html: true });
const deadLinks = [];

for (const file of markdownFiles) {
  const relativePath = slash(path.relative(srcDir, file));
  const source = await readFile(file, "utf8");
  const environment = {
    path: file,
    realPath: file,
    relativePath,
    cleanUrls: false,
    includes: [],
  };

  markdown.render(source, environment);

  for (const originalUrl of environment.links ?? []) {
    const { pathname } = new URL(originalUrl, "http://local.microi");
    if (!isPageLink(pathname)) continue;

    let url = originalUrl.replace(/[?#].*$/, "").replace(/\.(html|md)$/, "");
    if (url.endsWith("/")) url += "index";

    const resolved = decodeURIComponent(
      slash(
        url.startsWith("/")
          ? url.slice(1)
          : path.relative(srcDir, path.resolve(path.dirname(file), url)),
      ),
    );
    const publicHtml = path.join(publicDir, `${resolved}.html`);

    if (!pages.has(resolved) && !existsSync(publicHtml)) {
      deadLinks.push({ file: relativePath, url });
    }
  }
}

if (deadLinks.length > 0) {
  for (const deadLink of deadLinks) {
    console.error(
      `(!) Found dead link ${deadLink.url} in file ${deadLink.file}`,
    );
  }
  console.error(`\nLink check failed: ${deadLinks.length} dead link(s) found.`);
  process.exitCode = 1;
} else {
  console.log(`Link check passed: ${markdownFiles.length} Markdown files checked.`);
}
