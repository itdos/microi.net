import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(helperDirectory, "../../..");
const releaseContractPath = path.resolve(
    repositoryRoot,
    "Microi.Server/Microi.Upgrade/Resource/platform-service-release.json"
);
const releaseContract = JSON.parse(readFileSync(releaseContractPath, "utf8"));

if (releaseContract?.SchemaVersion !== 1 || releaseContract?.AppKey !== "microi-platform-service") {
    throw new Error("平台内置微服务发布契约无效");
}
if (releaseContract?.SourceRole !== "CanonicalReleaseSource" || !releaseContract?.SourceRoot) {
    throw new Error("平台内置微服务没有配置唯一正式源码根");
}

export const platformServiceSourceRoot = path.resolve(repositoryRoot, releaseContract.SourceRoot);

export function platformServiceSourcePath(...segments) {
    return path.resolve(platformServiceSourceRoot, ...segments);
}

export function readPlatformServiceSource(relativePath, encoding = "utf8") {
    return readFileSync(platformServiceSourcePath(relativePath), encoding);
}
