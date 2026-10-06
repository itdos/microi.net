import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export const sourceZipCode = await readFile(new URL('./ai-app-download-source-zip.js', import.meta.url), 'utf8');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const copy = value => JSON.parse(JSON.stringify(value));
export function sourceFixture(count = 3) {
  const app = { Id: 'app-source-test', Name: '源码', AppKey: 'mci-source-test', UserId: 'owner', PrivateSourcePath: '/itdos/ai-app-source-staged/app-source-test/committed-current', IsDeleted: 0 };
  const user = { Id: 'owner', State: 1, Level: 0, IsDeleted: 0 };
  const bytes = new Map(), rows = [];
  for (let index = 0; index < count; index++) {
    const path = index === 0 ? 'package.json' : `src/file-${String(index).padStart(5, '0')}.bin`;
    const content = index === 1 ? Buffer.from([0, 255, 128, 13, 10]) : Buffer.from(`当前源码 ${index}`);
    const hdfs = `${app.PrivateSourcePath}/${path}`;
    bytes.set(hdfs, content);
    rows.push({ Id: `row-${String(index).padStart(5, '0')}`, AppId: app.Id, VersionId: null, FilePath: path, HdfsPath: hdfs, StorageScope: 'Private', ContentHash: sha256(content), Size: content.length, IsDirectory: 0, IsDeleted: 0 });
  }
  return { app, user, rows, bytes };
}

// 显式模拟 FE 的活动源条件和可信 HDFS 字节边界；不模拟上传、发布或数据库写入。
export async function runSourceZip(fixture = sourceFixture(), options = {}) {
  const state = { app: copy(fixture.app), user: copy(fixture.user), rows: copy(fixture.rows), queries: [], reads: [], zips: [], zipReads: [], hashFactories: 0, writes: 0, signedUrls: 0, httpReads: 0, appReads: 0, userReads: 0 };
  const bytes = new Map(fixture.bytes), userId = options.userId ?? state.user.Id;
  const V8 = {
    OsClient: options.tenant || 'iTdos', CurrentUser: { Id: userId, ...(options.currentUser || {}) }, Param: { AppId: state.app.Id, ...(options.param || {}) },
    EncryptHelper: { Sha256Hex: text => sha256(Buffer.from(text)) },
    FormEngine: {
      GetFormData(table) {
        if (table === 'sys_microistore') { state.appReads++; options.onApp?.(state); return { Code: 1, Data: state.app }; }
        if (table === 'sys_user') { state.userReads++; options.onUser?.(state); return { Code: 1, Data: state.user }; }
        throw new Error(`unexpected table ${table}`);
      },
      GetTableData(table, query) {
        state.queries.push(copy(query)); options.onQuery?.(state, query);
        if (options.metadataFailure) return { Code: 0 };
        if (table !== 'mci_ai_app_file') throw new Error(`unexpected table ${table}`);
        const where = query._Where, currentOnly = where.some(condition => condition.includes('VersionId'));
        const prefixes = where.filter(condition => condition.includes('StartLike')).map(condition => condition[condition.indexOf('StartLike') + 1]);
        let rows = options.unsafeRows ? [...state.rows] : state.rows.filter(row => row.AppId === state.app.Id);
        if (currentOnly && !options.unsafeRows) rows = rows.filter(row => (row.VersionId === null || row.VersionId === '') && row.StorageScope === 'Private' && row.IsDirectory === 0 && (row.IsDeleted === null || row.IsDeleted === 0) && prefixes.some(prefix => row.HdfsPath.startsWith(prefix)));
        rows.sort((left, right) => String(left.Id) < String(right.Id) ? -1 : String(left.Id) > String(right.Id) ? 1 : 0);
        const size = query._PageSize || 5000, page = query._PageIndex || 1;
        return { Code: 1, Data: copy(rows.slice((page - 1) * size, page * size)), DataCount: options.dataCount ?? rows.length };
      },
      AddFormData() { state.writes++; throw new Error('unexpected write'); },
      UptFormData() { state.writes++; throw new Error('unexpected write'); }
    },
    HDFS: { async GetPrivateFileByte(param) {
      state.reads.push(copy(param)); options.onRead?.(state, bytes, param);
      if (options.storageThrow) throw new Error('private upstream address must never be returned');
      if (options.storageFailure) return { Code: 0, Msg: 'private upstream address must never be returned' };
      return { Code: 1, Data: bytes.get(param.FilePathName) };
    } },
    Method: {
      GetPrivateFileUrl(param) { state.signedUrls++; return { Code: 1, Data: { Url: param.FilePathName } }; },
      CreateZip(param) {
        state.zips.push(copy(param)); options.onZip?.(state);
        const entries = copy(param.Entries); options.alterArchive?.(entries);
        const wire = Buffer.from(JSON.stringify(entries));
        return options.zipFailure ? { Code: 0 } : { Code: 1, Data: { FileByteBase64: wire.toString('base64'), Size: wire.length, Sha256: sha256(wire) } };
      }
    },
    Http: { GetResponse(param) { state.httpReads++; return { RawBytes: bytes.get(param.Url) }; } }
  };
  if (!options.zipReaderMissing) {
    // 仿真既有原子的可信返回：以将要返回的归档实际条目算原始字节SHA，不另读HDFS对象。
    const reader = param => {
      state.zipReads.push(copy({ ...param, FileByteBase64: undefined }));
      if (options.zipReaderThrow) throw Error('private upstream address');
      if (options.zipReaderFailure) return { Code: 0, Msg: 'private upstream address' };
      const entries = JSON.parse(Buffer.from(param.FileByteBase64, 'base64').toString()).map(entry => {
        const bytes = Buffer.from(entry.FileByteBase64, 'base64');
        return { ...entry, Size: bytes.length, Sha256: sha256(bytes) };
      });
      const data = { Entries: entries, FileCount: entries.length, TotalSize: entries.reduce((sum, item) => sum + item.Size, 0) };
      options.alterReader?.(data); return { Code: 1, Data: data };
    };
    V8.Method[options.readZipAlias ? 'ReadZip' : 'ExtractZip'] = reader;
  }
  const System = {
    Convert: { ToBase64String: content => Buffer.from(content).toString('base64') },
    BitConverter: { ToString: content => Buffer.from(content).toString('hex').match(/../g).join('-') },
    Security: { Cryptography: { SHA256: { Create: () => {
      state.hashFactories++;
      if (options.nativeHashFailure) throw new Error('SHA256 CLR type unavailable');
      return { ComputeHash: content => createHash('sha256').update(content).digest(), Dispose() {} };
    } } } }
  };
  const result = await vm.runInNewContext(`(async function() {\n${options.code || sourceZipCode}\n})()`, { V8, System }, { timeout: 5000 });
  return { result: copy(result), state, bytes };
}
