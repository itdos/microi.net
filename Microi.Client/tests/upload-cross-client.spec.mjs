import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { resolveUploadLimit, sanitizeUploadMeta } from '../src/utils/upload-response.js';

const source = fs.readFileSync(new URL('../src/views/form-engine/diy-field-component/diy-imgupload.vue', import.meta.url), 'utf8');
function setup(multiple = false) {
    const props = { field: { Name: 'Photo', Config: { ImgUpload: { Multiple: multiple, Limit: false } } } };
    const sandbox = { props, resolveUploadLimit, DiyCommon: { IsNull: value => value === null || value === undefined || value === '' } };
    const normalize = source.slice(source.indexOf('const normalizeUploadItem ='), source.indexOf('// 计算属性', source.indexOf('const normalizeUploadItem =')));
    vm.runInNewContext(normalize + '\nglobalThis.normalize = normalizeValue;', sandbox);
    return sandbox.normalize;
}

test('平台单图兼容小程序的单元素数组及数组 JSON', () => {
    const normalize = setup();
    const file = { Id: 'file', Path: '/tenant/img/photo.jpg', Limit: true };
    for (const raw of [[file], JSON.stringify([file])]) {
        const actual = normalize(raw);
        assert.equal(actual.Path, file.Path);
        assert.equal(actual.Limit, true);
        assert.equal(actual.State, 1);
    }
});

test('多图保留顺序、名称、状态与私有属性', () => {
    const normalize = setup(true);
    const files = [{ Path: '/a.jpg', Name: 'a', Limit: true }, { Path: '/b.jpg', State: 0 }];
    const actual = normalize(JSON.stringify(files));
    assert.equal(actual.length, 2);
    assert.equal(actual[0].Name, 'a');
    assert.equal(actual[0].Limit, true);
    assert.equal(actual[1].State, 0);
});

test('实际公私桶标记属于持久化元数据，签名 URL 仍剔除', () => {
    const actual = sanitizeUploadMeta({ Path: '/a.jpg', Limit: true, Url: 'https://temporary.example/signed' });
    assert.equal(actual.Limit, true);
    assert.equal(actual.Url, undefined);
    assert.equal(resolveUploadLimit({ Limit: 1 }, false), true);
    assert.equal(resolveUploadLimit({ Limit: '1' }, false), true);
});

test('平台单图取址按数组中照片实际 Limit 签名，公有照片取 CDN', () => {
    const privateFile = { Id: 'file', Path: '/tenant/img/photo.jpg', Limit: true };
    const props = {
        field: { Name: 'Photo', Id: 'field', Config: { ImgUpload: { Multiple: false, Limit: false } } },
        FormDiyTableModel: { Id: 'row', Photo: JSON.stringify([privateFile]) }, DiyTableModel: { Name: 'partners' }, SysMenuId: 'menu'
    };
    const calls = [];
    const sandbox = { props, resolveUploadLimit, SysConfig: { value: {} }, DiyCommon: {
        IsNull: value => value === null || value === undefined || value === '',
        GetServerPath: path => `https://cdn.example.test${path}`,
        Result: result => result.Code === 1,
        Post: (url, params, done) => { calls.push({ url, params }); done({ Code: 1, Data: 'https://private.example.test/signed' }); }
    } };
    const normalize = source.slice(source.indexOf('const normalizeUploadItem ='), source.indexOf('// 计算属性', source.indexOf('const normalizeUploadItem =')));
    const getPath = source.slice(source.indexOf('const GetUploadPath ='), source.indexOf('// 监听modelValue变化'));
    vm.runInNewContext(normalize + getPath + '\nglobalThis.getPath = GetUploadPath;', sandbox);
    sandbox.getPath(null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].params.FilePathName, privateFile.Path);
    assert.equal(calls[0].params.FormDataId, 'row');
    assert.equal(calls[0].params.FieldId, 'field');
    assert.equal(props.FormDiyTableModel.Photo_Photo_RealPath, 'https://private.example.test/signed');
    props.FormDiyTableModel.Photo = JSON.stringify({ Path: '/tenant/img/public.jpg', State: 1 });
    sandbox.getPath(null);
    assert.equal(calls.length, 1);
    assert.equal(props.FormDiyTableModel.Photo_Photo_RealPath, 'https://cdn.example.test/tenant/img/public.jpg');
});
