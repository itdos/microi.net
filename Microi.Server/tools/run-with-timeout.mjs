import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Portable fallback for short release probes; only terminates the child it owns.
export function runWithTimeout(command, args, milliseconds) {
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: 'inherit' });
    let expired = false, forceTimer;
    const timer = setTimeout(() => {
      expired = true;
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => child.kill('SIGKILL'), 500);
      forceTimer.unref();
    }, milliseconds);
    timer.unref();
    const finish = code => {
      clearTimeout(timer);
      clearTimeout(forceTimer);
      resolve(expired ? 124 : code);
    };
    child.once('error', () => finish(127));
    child.once('close', code => finish(code ?? 1));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [seconds, command, ...args] = process.argv.slice(2);
  if (!command || !Number.isFinite(Number(seconds)) || Number(seconds) <= 0) {
    process.stderr.write('Usage: run-with-timeout.mjs <positive seconds> <command> [args]\n');
    process.exitCode = 2;
  } else {
    process.exitCode = await runWithTimeout(command, args, Number(seconds) * 1000);
  }
}
