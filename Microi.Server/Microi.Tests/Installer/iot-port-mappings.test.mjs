import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const installers = [
  '数据库、案例、文档、资料/install-microi.sh',
  '数据库、案例、文档、资料/install-microi-offline.sh',
];
const bash = process.platform === 'win32'
  ? ['D:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/bin/bash.exe'].find(existsSync)
  : 'bash';

for (const installer of installers) {
  test(`${installer} maps MQTT and raw TCP into the existing API container`, () => {
    const source = readFileSync(resolve(root, installer), 'utf8');
    assert.match(source, /MQTT_PORT=.*PORT_BASE/);
    assert.match(source, /TCP_INGRESS_PORT=.*PORT_BASE/);
    assert.match(source, /ALL_PORTS=.*\$\{MQTT_PORT\}.*\$\{TCP_INGRESS_PORT\}/);
    assert.match(source, /microi-install-api:[\s\S]*?- "\$\{API_PORT\}:80"\s*- "\$\{MQTT_PORT\}:1883\/tcp"\s*- "\$\{TCP_INGRESS_PORT\}:1885\/tcp"/);
  });
}

test('online installer allocates IoT ports after optional services and opens host firewall', () => {
  const source = readFileSync(resolve(root, installers[0]), 'utf8');
  assert.match(source, /PORT_LABELS\+=\("MQTT\(microi-install-api\)" "TCP\(microi-install-api\)"\)/);
  assert.match(source, /FIREWALL_PORTS="\$\{VUE_PORT\} \$\{API_PORT\} \$\{MQTT_PORT\} \$\{TCP_INGRESS_PORT\}"/);
  assert.ok(source.indexOf('PORT_LABELS+=("MQTT(microi-install-api)"') > source.indexOf('PORT_LABELS+=("Ollama"'));
});

test('online official database install enables MQTT without overwriting restored tenants', () => {
  const source = readFileSync(resolve(root, installers[0]), 'utf8');
  assert.match(source, /enable_mqtt_for_official_install\(\) \{\s*\[ "\$\{SQL_SOURCE_MODE\}" = 'official' \] \|\| return 0/);
  assert.match(source, /SET \$\{left\}MqttEnable\$\{right\}=1/);
  assert.match(source, /ensure_runtime_main_tenant\s+enable_mqtt_for_official_install/);
  assert.match(source, /MICROI_FRESH_MQTT_DEFAULT_READY/);
});

test('official MQTT default SQL is scoped to one main tenant and custom restores are untouched', () => {
  assert.ok(bash, 'Bash is required to exercise the installer function');
  const source = readFileSync(resolve(root, installers[0]), 'utf8').replaceAll('\r\n', '\n');
  const fn = source.match(/^enable_mqtt_for_official_install\(\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(fn);
  const stub = `database_exec_sql(){ printf '%s\\n' "$1" >&2; case "$1" in SELECT*) printf '%s\\n' MICROI_FRESH_MQTT_DEFAULT_READY;; esac; }\n`;
  const vars = "OS_CLIENT=xjy; RUNTIME_OS_CLIENT_TYPE=Product; RUNTIME_OS_CLIENT_NETWORK=Internal; DATABASE_CHOICE=1; ";
  const restored = spawnSync(bash, ['-c', stub + vars + "SQL_SOURCE_MODE=custom;\n" + fn + '\nenable_mqtt_for_official_install'], { encoding: 'utf8', windowsHide: true });
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(restored.stderr, '');
  const fresh = spawnSync(bash, ['-c', stub + vars + "SQL_SOURCE_MODE=official;\n" + fn + '\nenable_mqtt_for_official_install'], { encoding: 'utf8', windowsHide: true });
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.match(fresh.stderr, /UPDATE sys_osclients SET `MqttEnable`=1 WHERE `OsClient`='xjy' AND `OsClientType`='Product' AND `OsClientNetwork`='Internal'/);
  assert.match(fresh.stderr, /COALESCE\(`IsDeleted`,0\)=0/);
});

test('offline installer preserves the existing first ten port offsets', () => {
  const source = readFileSync(resolve(root, installers[1]), 'utf8');
  assert.match(source, /PORT_COUNT=12/);
  assert.match(source, /API_PORT=\$\(\(PORT_BASE \+ 8\)\)/);
  assert.match(source, /VUE_PORT=\$\(\(PORT_BASE \+ 9\)\)/);
  assert.match(source, /MQTT_PORT=\$\(\(PORT_BASE \+ 10\)\)/);
  assert.match(source, /TCP_INGRESS_PORT=\$\(\(PORT_BASE \+ 11\)\)/);
});
