import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../../Microi.net/License/scripts/encrypt-dll.sh', import.meta.url)).replaceAll('\\', '/');
function convert(platform, path, converter = false) {
  const program = `source "$1"
uname() { printf '%s\\n' "$MICROI_TEST_UNAME"; }
${converter ? `cygpath() { test "$1" = '-w'; printf 'native-converter:%s\\n' "$2"; }` : `command() { if [[ "$1" == '-v' && "$2" == 'cygpath' ]]; then return 1; fi; builtin command "$@"; }`}
to_win_path "$2"`;
  const result = spawnSync('bash', ['-c', program, 'encryption-path-test', script, path], {
    encoding: 'utf8', env: { ...process.env, MICROI_TEST_UNAME: platform }, timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trimEnd();
}

test('macOS absolute paths remain native even when cygpath is available', () => {
  for (const path of ['/Users/anderson/Work/Microi.net.dll', '/usr/local/share/dotnet', '/d/ordinary-folder']) {
    assert.equal(convert('Darwin', path, true), path);
  }
});
test('Linux paths and Unicode or spaces are preserved', () => {
  for (const path of ['/home/user/吾码 发布/Microi.AI.dll', '/usr/share/dotnet']) {
    assert.equal(convert('Linux', path), path);
  }
});
test('Git Bash converts only complete drive-root paths without cygpath', () => {
  assert.equal(convert('MINGW64_NT-10.0', '/d/吾码 发布/Microi.MCP.dll'), 'D:\\吾码 发布\\Microi.MCP.dll');
  assert.equal(convert('MSYS_NT-10.0', '/c'), 'C:');
  assert.equal(convert('MINGW64_NT-10.0', '/Users/anderson'), '/Users/anderson');
  assert.equal(convert('MINGW64_NT-10.0', 'D:\\Work\\Microi.Vision.dll'), 'D:\\Work\\Microi.Vision.dll');
});
test('Windows shells prefer their actual cygpath converter', () => {
  assert.equal(convert('CYGWIN_NT-10.0', '/cygdrive/d/Work', true), 'native-converter:/cygdrive/d/Work');
});
