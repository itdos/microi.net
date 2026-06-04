import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(clientDir, '..');
const apiDir = path.join(repoRoot, 'Microi.Server', 'Microi.net.Api');
const apiProject = process.env.PW_BACKEND_PROJECT || path.join(apiDir, 'Microi.net.Api.csproj');
const launchSettingsPath = process.env.PW_LAUNCH_SETTINGS_PATH || path.join(apiDir, 'Properties', 'launchSettings.json');
const backendEnv = process.env.PW_BACKEND_ENV || process.env.MICROI_BACKEND_ENV || process.env.PW_ASPNETCORE_ENVIRONMENT || process.env.DOTNET_ENVIRONMENT || 'iTdos';
const aspnetcoreEnvironment = process.env.PW_ASPNETCORE_ENVIRONMENT || backendEnv;
const dotnetEnvironment = process.env.PW_DOTNET_ENVIRONMENT || backendEnv;
const appsettingsEnv = process.env.PW_APPSETTINGS_ENV || dotnetEnvironment;
const appsettingsPath = process.env.PW_APPSETTINGS_PATH || path.join(apiDir, `appsettings.${appsettingsEnv}.json`);
const backendUrl = process.env.BACKEND || process.env.PW_API_BASE || 'https://localhost:7266';
const frontendUrl = process.env.FRONTEND || process.env.PW_BASE_URL || 'http://localhost:1988';
const osClient = process.env.MICROI_OSCLIENT || process.env.PW_OS_CLIENT || appsettingsEnv;
const launchProfile = process.env.PW_BACKEND_PROFILE || 'Microi.net.Api';

function isTruthy(value) {
    return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function isExplicitFalse(value) {
    return value === false || value === 0 || value === '0' || value === 'false' || value === 'no' || value === 'off';
}

function shouldRun(value, defaultValue = true) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return !isExplicitFalse(value);
}

function resolveMaybeRelative(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}

async function readJson(filePath) {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
}

async function writeJsonIfChanged(filePath, data) {
    const nextText = `${JSON.stringify(data, null, 2)}\n`;
    let currentText = '';
    try {
        currentText = await fs.readFile(filePath, 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    if (currentText !== nextText) {
        await fs.writeFile(filePath, nextText, 'utf8');
        console.log(`[microi-e2e] updated ${path.relative(repoRoot, filePath)}`);
        return true;
    }
    return false;
}

async function configureLaunchSettings() {
    const json = await readJson(resolveMaybeRelative(launchSettingsPath));
    json.profiles = json.profiles || {};
    json.profiles[launchProfile] = json.profiles[launchProfile] || { commandName: 'Project' };
    const profile = json.profiles[launchProfile];
    profile.environmentVariables = profile.environmentVariables || {};
    profile.environmentVariables.ASPNETCORE_ENVIRONMENT = aspnetcoreEnvironment;
    profile.environmentVariables.DOTNET_ENVIRONMENT = dotnetEnvironment;
    if (process.env.PW_BACKEND_APPLICATION_URL) {
        profile.applicationUrl = process.env.PW_BACKEND_APPLICATION_URL;
    }
    await writeJsonIfChanged(resolveMaybeRelative(launchSettingsPath), json);
}

async function configureDevLoginBypass() {
    const filePath = resolveMaybeRelative(appsettingsPath);
    const json = await readJson(filePath);
    const existing = json.DevLoginBypass || {};
    const account = process.env.PW_TEST_ACCOUNT || process.env.PW_DEV_LOGIN_ACCOUNT || existing.DefaultAccount || 'admin';
    const password = process.env.PW_TEST_PASSWORD || process.env.PW_DEV_LOGIN_PASSWORD || existing.DefaultPassword || 'microi#2026';

    json.DevLoginBypass = {
        '//': existing['//'] || 'Local development / E2E login bypass. Keep disabled in production.',
        Enabled: shouldRun(process.env.PW_DEV_LOGIN_BYPASS, true),
        SkipCaptcha: shouldRun(process.env.PW_DEV_SKIP_CAPTCHA, true),
        OnlyLoopback: shouldRun(process.env.PW_DEV_ONLY_LOOPBACK, true),
        DefaultAccount: account,
        DefaultPassword: password
    };
    await writeJsonIfChanged(filePath, json);
    return { account, password };
}

function isLocalUrl(url) {
    try {
        const parsed = new URL(url);
        return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname);
    } catch (error) {
        return false;
    }
}

async function canReach(url, timeoutMs = 1500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        await fetch(url, { signal: controller.signal });
        return true;
    } catch (error) {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

async function waitForUrl(url, timeoutMs = 180_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await canReach(url, 3000)) return;
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for backend: ${url}`);
}

function spawnManaged(command, args, options) {
    const useShell = process.platform === 'win32' && /\.cmd$/i.test(command);
    const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        shell: useShell
    });
    if (!options.inherit) {
        child.stdout.on('data', (chunk) => process.stdout.write(`[${options.label}] ${chunk}`));
        child.stderr.on('data', (chunk) => process.stderr.write(`[${options.label}] ${chunk}`));
    }
    return child;
}

async function runChild(command, args, options) {
    return await new Promise((resolve, reject) => {
        const child = spawnManaged(command, args, { ...options, inherit: true });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${command} exited with code ${code}`));
        });
    });
}

async function startBackendIfNeeded() {
    const shouldStartBackend = shouldRun(process.env.PW_START_BACKEND, isLocalUrl(backendUrl));
    if (!shouldStartBackend) return null;
    if (await canReach(backendUrl)) {
        console.log(`[microi-e2e] backend already reachable: ${backendUrl}`);
        return null;
    }

    const command = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
    const resolvedApiProject = resolveMaybeRelative(apiProject);
    const backendCwd = path.dirname(resolvedApiProject);
    const args = ['run', '--project', resolvedApiProject, '--launch-profile', launchProfile];
    const env = {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: aspnetcoreEnvironment,
        DOTNET_ENVIRONMENT: dotnetEnvironment
    };
    console.log(`[microi-e2e] starting backend ${path.relative(repoRoot, resolvedApiProject)} (${dotnetEnvironment})`);
    const child = spawnManaged(command, args, { cwd: backendCwd, env, label: 'api' });
    await waitForUrl(backendUrl);
    return child;
}

async function main() {
    if (shouldRun(process.env.PW_CONFIG_BACKEND, true)) {
        await configureLaunchSettings();
    }
    const login = shouldRun(process.env.PW_CONFIG_DEV_LOGIN, true)
        ? await configureDevLoginBypass()
        : {
            account: process.env.PW_TEST_ACCOUNT || 'admin',
            password: process.env.PW_TEST_PASSWORD || ''
        };

    let backendProcess = null;
    try {
        backendProcess = await startBackendIfNeeded();
        const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const args = ['playwright', 'test', 'tests/form-engine-freeze-trace.spec.mjs', '--reporter=list'];
        if (shouldRun(process.env.PW_HEADED, true)) args.push('--headed');
        await runChild(npx, args, {
            cwd: clientDir,
            env: {
                ...process.env,
                FRONTEND: frontendUrl,
                BACKEND: backendUrl,
                MICROI_OSCLIENT: osClient,
                PW_TEST_ACCOUNT: login.account,
                PW_TEST_PASSWORD: login.password,
                NODE_TLS_REJECT_UNAUTHORIZED: '0'
            }
        });
    } finally {
        if (backendProcess) {
            backendProcess.kill();
        }
    }
}

main().catch((error) => {
    console.error(`[microi-e2e] ${error.stack || error.message}`);
    process.exit(1);
});
