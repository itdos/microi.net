import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import descriptor, { policyFields } from './file-resource-manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.join(here, 'engines/mci-file-resource-manager.js');
const code = fs.readFileSync(enginePath, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(descriptor.ownerAppId, 'app.microi.sys-log');
assert.equal(descriptor.runtimeRoutingEnabled, false);
assert.equal(descriptor.trustedCollectorsEnabled, false);
assert.equal(descriptor.replicaWorkersEnabled, false);

// Standard MCP Manifest. It deliberately contains no Sys_Config table/seed:
// the existing current-tenant values and field identities are read-only preconditions.
export const manifest = {
  name: '系统日志/监控：受管热点公开资源目录（关闭状态的母版准备）',
  tables: descriptor.tables.map((table, i) => ({
    name: table.name, description: table.description, readPrimary: 1, v8Limit: false,
    tabs: [{ Id: 'metadata', Name: '目录与证据', Sort: 10 }],
    formBanner: {
      enabled: true,
      titleField: i === 0 ? 'Name' : 'ResourceId',
      subtitleField: i === 0 ? 'ObjectKey' : i === 1 ? 'DataSource' : 'TargetObjectKey',
      imageField: '', backgroundField: '', icon: 'fas fa-file-shield', metrics: [],
      tagFields: [{ Field: i === 0 ? 'AuthorityState' : i === 1 ? 'EvidenceState' : 'State' }],
    },
    fields: table.fields.map((field, index) => ({
      ...field, tab: 'metadata', sort: (index + 1) * 10,
      visible: 1, appVisible: 1, tableWidth: field.name.endsWith('Utc') ? 160 : 180,
      readonly: 1,
    })),
    indexes: table.indexes.map(index => ({ ...index, unique: index.unique === true,
      purpose: '当前租户资源协议的有序物理索引；必须在生成后按列顺序与唯一性回读。' })),
  })),
  engines: [{
    apiEngineKey: 'mci-file-resource-manager', apiName: '受管热点公开资源管理',
    category: '系统日志/监控', apiAddress: '/apiengine/mci-file-resource-manager',
    v8Limit: false, allowAnonymous: false, code,
  }],
  roles: [], modules: [], permissions: [], events: [], dataSources: [], pages: [],
  printTemplates: [], workflows: [], jobs: [],
};

export const contract = {
  protocol: descriptor.protocol,
  stage: 'LocalCandidateOnly',
  ownerAppId: descriptor.ownerAppId,
  officialMasterTarget: { profile: 'microi_itdos_api_itdos_com', apiBase: 'https://api.itdos.com', osClient: 'iTdos' },
  publicRoutingEnabled: false, trustedCollectorsEnabled: false, replicaWorkersEnabled: false,
  currentTenantOnly: true, allowCrossTenantRegistration: false,
  allowPrivateSources: false, seedResources: false, copiedObjectCount: 0,
  policyFieldNames: policyFields.map(field => field.name),
  genericPackageDefaults: { FileServerBakThresholdGiB: null, FileServerBakWindowHours: 24 },
  currentTenantRequestedPolicy: { Tenant: 'iTdos', FileServerBakThresholdGiB: 1, FileServerBakWindowHours: 24 },
  configurationIsPreexisting: true, configurationIsWrittenByThisManifest: false,
  packageOwners: {
    catalogAndManager: 'app.microi.sys-log',
    systemConfiguration: ['app.microi.sys-config', 'app.microi.saas-engine'],
  },
  resourcePolicies: { ApiEngines: { 'mci-file-resource-manager': { Ownership: 'Application', UpgradePolicy: 'Managed' } } },
  sourceHashes: {
    descriptor: sha(fs.readFileSync(path.join(here, 'file-resource-manifest.mjs'))),
    manager: sha(code),
  },
  counts: {
    tables: manifest.tables.length,
    fields: manifest.tables.reduce((n, table) => n + table.fields.length, 0),
    indexes: manifest.tables.reduce((n, table) => n + table.indexes.length, 0),
    engines: manifest.engines.length,
  },
  securityLimitations: [
    'Readonly is a UI property, not a generic FormEngine write restriction.',
    'No role or module grant is installed. Ordinary unauthorized users remain denied.',
    'Administrators and users later granted table CRUD can bypass manager invariants through generic CRUD.',
    'Form events alone are insufficient because _RunV8Event can skip them.',
    'All traffic/replica rows remain untrusted; Evaluate always returns Unknown/Unverified/UseBackup=false.',
  ],
  activationBlockers: [
    'Trusted backend write boundary for catalog, traffic evidence and replica authority.',
    'Fresh complete per-object traffic collector; historical summaries do not provide current evidence.',
    'Verified replica worker and source/runtime version binding.',
    'Runtime consumers, dependency groups and explicit cross-tenant governance when needed.',
  ],
  installMeaning: 'Only empty metadata tables/indexes and a fail-closed administrator engine; not file replication or routing.',
  officialMasterRule: 'Maintain selected master metadata; do not invoke an app import/install engine on the official publishing source, including ValidateOnly.',
  publishedPackageVersionChanged: false,
};

export function buildMaterials() {
  const out = path.join(here, 'file-resource-install');
  fs.mkdirSync(out, { recursive: true });
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const contractText = JSON.stringify({ ...contract, manifestFileSha256: sha(manifestText) }, null, 2) + '\n';
  fs.writeFileSync(path.join(out, 'manifest.json'), manifestText, 'utf8');
  fs.writeFileSync(path.join(out, 'installation-contract.json'), contractText, 'utf8');
  return { out, ...contract.counts, manifestFileSha256: sha(manifestText), remoteWrites: 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(buildMaterials(), null, 2));
}
