import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentSource = await readFile(new URL("../src/views/file-manage/components/FileSyncDialog.vue", import.meta.url), "utf8");

test("file sync task records stay on the current platform that owns the log view", () => {
    assert.match(componentSource, /const updateProgress = async \(status = 'Running'\)/);
    assert.match(componentSource, /const result = await fileManageApi\.recordSyncTask\(payload\)/);
    assert.doesNotMatch(componentSource, /runApiEngine\('mci_file_sync_record', payload, sourcePlatform\)/);
});

test("record progress advances only after a successful business response", () => {
    assert.match(componentSource, /if \(result\?\.Code !== 1\) \{\s*throw new Error\(result\?\.Msg \|\| '更新同步任务记录失败'\)\s*\}\s*recordedResultCount = results\.value\.length/s);
});

test("pending sync items are not displayed as failed", () => {
    assert.match(componentSource, /if \(status === 'Pending'\) return '待同步'/);
    assert.match(componentSource, /if \(status === 'Pending'\) return 'warning'/);
});
