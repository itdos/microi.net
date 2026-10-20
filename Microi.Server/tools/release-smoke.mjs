import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export async function checkRuntime(baseUrl, osClient, request = fetch) {
  const checks = [];
  for (const pathname of ['/api/Diagnostics/liveness', '/apiengine/platform-sys-config']) {
    const url = new URL(pathname, baseUrl);
    url.searchParams.set('OsClient', osClient);
    const response = await request(url, {signal: AbortSignal.timeout(15000), cache:'no-store'});
    const body = await response.json();
    if (response.status !== 200 || body?.Code !== 1 || !body.Data || typeof body.Data !== 'object')
      throw new Error(`Smoke failed: ${pathname} HTTP ${response.status}, Code ${body?.Code}`);
    if (pathname.endsWith('/liveness') && body.Data.Status !== 'Healthy')
      throw new Error('Smoke failed: host is not Healthy');
    checks.push({path:pathname, httpStatus:response.status, code:body.Code});
  }
  return checks;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baseUrl, osClient, output, directory] = process.argv.slice(2);
  if (!baseUrl || !osClient || !output || !directory) throw new Error('Usage: release-smoke <url> <tenant> <receipt> <publish-directory>');
  const files = {};
  for (const name of ['Microi.net.Api.dll','Microi.net.dll','Microi.Core.dll','Microi.AI.dll','Microi.MCP.dll','Microi.WorkFlow.dll','Microi.Vision.dll'])
    files[name] = createHash('sha256').update(await fs.readFile(path.join(directory,name))).digest('hex');
  const checks = await checkRuntime(baseUrl, osClient);
  await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
  await fs.writeFile(output, JSON.stringify({schema:1,passed:true,checkedAt:new Date().toISOString(),files,checks},null,2));
  console.log('Runtime smoke passed: liveness + tenant configuration; assembly hashes recorded.');
}
