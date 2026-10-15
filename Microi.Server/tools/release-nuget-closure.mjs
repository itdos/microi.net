import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enumeratePendingPackages, readPendingPackageList } from './release-encryption.mjs';

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// 只读取实际 ZIP 中唯一的包清单；不根据文件名或旧 obj 推测依赖。
function packageMetadata(files) {
    const pythonScript = `import json, sys, zipfile, xml.etree.ElementTree as ET
result=[]
for filename in json.load(sys.stdin):
 with zipfile.ZipFile(filename) as archive:
  entries=archive.infolist()
  if len({e.filename for e in entries}) != len(entries): raise ValueError('Duplicate ZIP entries')
  specs=[e for e in entries if e.filename.lower().endswith('.nuspec') and '/' not in e.filename and '\\\\' not in e.filename]
  if len(specs)!=1 or specs[0].file_size>1048576: raise ValueError('Package must contain one bounded root nuspec')
  data=archive.read(specs[0])
  if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper(): raise ValueError('DTD is forbidden in nuspec')
  root=ET.fromstring(data)
  local=lambda e:e.tag.rsplit('}',1)[-1]
  metadata=[e for e in root if local(e)=='metadata']
  if len(metadata)!=1: raise ValueError('Package must contain one metadata element')
  metadata=metadata[0]
  def field(name):
   values=[e.text for e in metadata if local(e)==name]
   if len(values)!=1: raise ValueError('Missing or duplicate package '+name)
   return values[0]
  dependencies=[{'id':e.attrib.get('id'), 'version':e.attrib.get('version')} for group in metadata if local(group)=='dependencies' for e in group.iter() if local(e)=='dependency']
  result.append({'id':field('id'), 'version':field('version'), 'dependencies':dependencies})
print(json.dumps(result))`;
    const input = JSON.stringify(files), options = { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] };
    for (const binary of process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python']) {
        try { execFileSync(binary, ['-c', 'import sys; assert sys.version_info >= (3,8)'], { stdio: 'ignore' }); }
        catch { continue; }
        return JSON.parse(execFileSync(binary, ['-c', pythonScript], options));
    }
    // Windows 无 Python 时使用系统 ZIP/XML 读取器；禁止 XML 外部解析器。
    const psScript = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.IO.Compression.FileSystem;
$files=([Console]::In.ReadToEnd() | ConvertFrom-Json); $result=[Collections.Generic.List[Object]]::new();
foreach($file in $files){
 $archive=[IO.Compression.ZipFile]::OpenRead($file); try {
  $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);
  foreach($entry in $archive.Entries){if(!$seen.Add($entry.FullName)){throw 'Duplicate ZIP entries'}}
  $specs=@($archive.Entries | Where-Object {$_.FullName -match '^[^/\\\\]+[.]nuspec$'});
  if($specs.Count -ne 1 -or $specs[0].Length -gt 1048576){throw 'Package must contain one bounded root nuspec'}
  $stream=$specs[0].Open(); $reader=[IO.StreamReader]::new($stream); try{$text=$reader.ReadToEnd()}finally{$reader.Dispose();$stream.Dispose()}
  if($text -match '<!DOCTYPE|<!ENTITY'){throw 'DTD is forbidden in nuspec'}
  $xml=[Xml.XmlDocument]::new();$xml.XmlResolver=$null;$xml.LoadXml($text);
  $metadata=@($xml.DocumentElement.SelectNodes('*[local-name()="metadata"]'));if($metadata.Count -ne 1){throw 'Package must contain one metadata element'}
  $ids=@($metadata[0].SelectNodes('*[local-name()="id"]'));$versions=@($metadata[0].SelectNodes('*[local-name()="version"]'));
  if($ids.Count -ne 1 -or $versions.Count -ne 1){throw 'Missing or duplicate package identity'}
  $dependencies=@($metadata[0].SelectNodes('*[local-name()="dependencies"]//*[local-name()="dependency"]') | ForEach-Object {@{id=$_.GetAttribute('id');version=$_.GetAttribute('version')}});
  $result.Add(@{id=$ids[0].InnerText;version=$versions[0].InnerText;dependencies=$dependencies})
 }finally{$archive.Dispose()}
}
[Console]::Write((ConvertTo-Json -InputObject @($result.ToArray()) -Depth 6 -Compress));`;
    for (const binary of ['pwsh', 'powershell.exe']) {
        try { return JSON.parse(execFileSync(binary, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(psScript, 'utf16le').toString('base64')], options)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    throw Error('NuGet dependency inspection requires Python 3 or PowerShell; publication is blocked');
}

export function verifyNugetClosure(server, version, listFile) {
    const pending = readPendingPackageList(listFile, server, version);
    assert.deepEqual(pending.files, enumeratePendingPackages(server, version), 'NuGet dependency inspection requires the complete pending upload set');
    const hashes = pending.files.map(sha), metadata = packageMetadata(pending.files);
    assert.equal(metadata.length, pending.files.length, 'NuGet metadata reader omitted a package');
    const packages = new Map();
    for (const [index, item] of metadata.entries()) {
        assert.match(item.id || '', /^[A-Za-z0-9_.-]+$/, 'Invalid NuGet package identity');
        assert.equal(item.version, version, `Actual NuGet package version differs: ${item.id}`);
        assert.equal(path.basename(pending.files[index]).toLowerCase(), `${item.id}.${version}.nupkg`.toLowerCase(), 'NuGet filename differs from actual package identity');
        const key = item.id.toLowerCase();
        assert.ok(!packages.has(key), `Duplicate NuGet package identity: ${item.id}`);
        assert.ok(Array.isArray(item.dependencies), 'Invalid NuGet dependencies'); packages.set(key, item);
    }
    for (const item of metadata) for (const dependency of item.dependencies) {
        assert.match(dependency.id || '', /^[A-Za-z0-9_.-]+$/, 'Invalid NuGet dependency identity');
        // SDK 项目引用写成最低版本；仅当前版平台依赖必须随本次集合发布，外部包和历史版本仍走 NuGet。
        if (/^(Microi\.|Dos\.)/i.test(dependency.id) && [version, `[${version}]`, `[${version},)`].includes(dependency.version))
            assert.ok(packages.has(dependency.id.toLowerCase()), `Missing same-release NuGet dependency: ${item.id} -> ${dependency.id} ${dependency.version}`);
    }
    assert.deepEqual(pending.files.map(sha), hashes, 'NuGet package changed during dependency inspection');
    assert.deepEqual(readPendingPackageList(listFile, server, version), pending, 'Pending NuGet list changed during dependency inspection');
    assert.deepEqual(pending.files, enumeratePendingPackages(server, version), 'NuGet upload set changed during dependency inspection');
    return { version, count: metadata.length, packages: metadata };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [server, version, list] = process.argv.slice(2);
    const proof = verifyNugetClosure(server, version, list);
    console.log(`NuGet ${proof.version} dependency closure verified for ${proof.count} actual packages.`);
}
