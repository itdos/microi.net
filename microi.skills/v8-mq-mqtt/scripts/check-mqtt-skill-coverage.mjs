import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..', '..', '..');

const files = {
  skill: 'microi.skills/v8-mq-mqtt/SKILL.md',
  reference: 'microi.skills/v8-mq-mqtt/references/mqtt-production.md',
  mqttDoc: 'microi.doc/docs/doc/system-engine/mqtt-engine.md',
  v8Doc: 'microi.doc/docs/doc/v8-engine/v8-server.md',
  runtime: 'Microi.Server/Microi.MQTT/MicroiMQTT.cs',
  model: 'Microi.Server/Microi.Core/Model/MqttParam.cs',
  mqttInterface: 'Microi.Server/Microi.Core/Interface/IMicroiMQTT.cs',
  tenantSecurity: 'Microi.Server/Microi.Core/SaaSEngine/TenantConfigurationSecurity.cs',
  controller: 'Microi.Server/Microi.net.Api/Controllers/MqttController.cs'
};

const content = {};
const failures = [];

for (const [name, relativePath] of Object.entries(files)) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${name}: 文件不存在 ${relativePath}`);
    content[name] = '';
    continue;
  }
  content[name] = fs.readFileSync(absolutePath, 'utf8');
}

function collectMatches(text, regex) {
  const values = [];
  for (const match of text.matchAll(regex)) values.push(match[1]);
  return values;
}

function requireTokens(targetName, tokens) {
  const text = content[targetName] || '';
  for (const token of tokens) {
    if (!text.includes(token)) failures.push(`${targetName}: 缺少 ${token}`);
  }
}

function requireAny(targetName, alternatives, label) {
  const text = content[targetName] || '';
  if (!alternatives.some((token) => text.includes(token))) {
    failures.push(`${targetName}: 缺少 ${label}`);
  }
}

const runtimeEvents = new Set([
  ...collectMatches(
    content.runtime,
    /RunMqttV8EngineAsync\([^,\r\n]+,\s*"([A-Za-z]+)"/g
  ),
  ...collectMatches(
    content.runtime,
    /FireV8EventForAllTenantsAsync\(\s*"([A-Za-z]+)"/g
  )
]);

const expectedEvents = [
  'StartServer',
  'Connected',
  'Disconnected',
  'Subscribing',
  'MessageReceived',
  'MessageChanged',
  'StopServer'
];

for (const eventName of expectedEvents) {
  if (!runtimeEvents.has(eventName)) failures.push(`runtime: 未提取到事件 ${eventName}`);
}

const mqttProperties = new Set(collectMatches(
  content.model,
  /public\s+[A-Za-z0-9_<>,.\s]+\s+([A-Za-z0-9_]+)\s*\{\s*get;\s*set;\s*\}/g
));

const expectedProperties = [
  'ClientId',
  'Payload',
  'PayloadRaw',
  'Topic',
  'OsClient',
  'UserName',
  'Qos',
  'Retain',
  'UserProperties'
];

for (const propertyName of expectedProperties) {
  if (!mqttProperties.has(propertyName)) failures.push(`model: 未提取到属性 ${propertyName}`);
}

const sourceEvents = [...runtimeEvents].sort();
const sourceProperties = [...mqttProperties].sort();
for (const targetName of ['skill', 'reference', 'mqttDoc', 'v8Doc']) {
  requireTokens(targetName, sourceEvents);
  requireTokens(targetName, sourceProperties);
}

const configurationTokens = [
  'MqttEnable',
  'MqttPort',
  'MqttUseTls',
  'MqttTlsPort',
  'MqttCertPath',
  'MqttCertPassword',
  'MqttFallbackPort',
  'MqttWsPort',
  'MqttAccount',
  'MqttPwd',
  'MqttApiEngine',
  'MqttAllowAnonymous',
  'MqttTopicIsolation'
];

const securityTokens = [
  'tenant/{lowerOsClient}',
  '$SYS',
  '$share',
  'ResponseTopic',
  'Code != 1',
  'StaleDisconnectIgnored'
];

const operationsTokens = [
  'mci_mqtt_client',
  'mci_mqtt_log',
  'ApiEngineId',
  'IMicroiMQTT.PublishAsync',
  'ConnectedClients',
  'GetConnectedClients',
  '外部 Broker',
  '独立 MQTT 节点'
];

requireTokens('skill', [
  'MqttEnable',
  'MqttPort',
  'MqttWsPort',
  'MqttAccount',
  'MqttPwd',
  'MqttApiEngine',
  'MqttAllowAnonymous',
  'MqttTopicIsolation'
]);
requireTokens('reference', configurationTokens);

for (const targetName of ['skill', 'reference']) {
  requireTokens(targetName, securityTokens);
  requireTokens(targetName, operationsTokens);
}

requireTokens(
  'mqttDoc',
  configurationTokens.filter((token) => token !== 'MqttAllowAnonymous')
);
requireAny(
  'mqttDoc',
  ['MqttAllowAnonymous', '匿名连接只可能由主租户显式开启'],
  '主租户匿名连接边界'
);
requireTokens(
  'mqttDoc',
  securityTokens.filter(
    (token) => token !== 'StaleDisconnectIgnored' && token !== 'tenant/{lowerOsClient}'
  )
);
requireAny(
  'mqttDoc',
  ['tenant/{lowerOsClient}', 'tenant/<lowerOsClient>'],
  '标准租户 Topic 模板'
);
requireTokens('v8Doc', ['## V8.MQTT', 'IMicroiMQTT.PublishAsync', 'Code != 1']);

requireTokens('runtime', [
  'NormalizeTopic',
  'ResponseTopic',
  'StaleDisconnectIgnored',
  '$share/',
  '$SYS/',
  'mci_mqtt_client',
  'mci_mqtt_log',
  'PublishRejectedByV8'
]);
requireTokens('mqttInterface', ['PublishAsync(string osClient', 'GetConnectedClients(string osClient)']);
requireTokens('tenantSecurity', ['NormalizeMqttTopic', 'HasTenantServiceCredentialCollision']);
requireTokens('controller', ['[PlatformAdminOnly]', 'StatusScope = "CurrentNode"']);

if (failures.length > 0) {
  console.error('MQTT Skill 覆盖检查失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `MQTT Skill 覆盖检查通过：${sourceEvents.length} 个事件、` +
    `${sourceProperties.length} 个 V8.MQTT 字段、` +
    `${configurationTokens.length} 个配置项及生产安全/部署契约均已覆盖。`
  );
}
