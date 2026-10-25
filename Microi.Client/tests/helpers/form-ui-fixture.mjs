import { randomUUID } from 'node:crypto';
import { prepareRichTextFixture } from './richtext-fixture.mjs';

// 通用 UI 回归只使用当前授权测试租户的自有资源，不依赖旧官网业务记录。
// 与富文本夹具共用 owner 校验和物理清理，额外字段/记录始终属于同一随机表。
export async function prepareFormUiFixture(request, options, kind) {
    const fixture = await prepareRichTextFixture(request, { ...options, apiBase: options.apiBase.replace(/\/+$/, '') });
    const addField = async field => {
        const value = await fixture.call('FormEngine/AddDiyFieldFromBody', {
            TableId: fixture.tableId, Type: 'varchar(200)', Visible: 1, AppVisible: 1,
            NameConfirm: 1, ...field
        });
        fixture.fields.push(value?.Id || value?.Data?.Id);
    };
    const updateTable = values => fixture.call('FormEngine/UptDiyTable', {
        Id: fixture.tableId, Name: fixture.tableName, Description: fixture.owner,
        ...values, ...(values.Tabs ? { Tabs: JSON.stringify(values.Tabs) } : {})
    }, true);
    const assignBaseTab = async tab => {
        for (const id of fixture.fields.filter(Boolean)) {
            const field = await fixture.call('FormEngine/GetFormData', { FormEngineKey: 'diy_field', Id: id });
            await fixture.call('FormEngine/UptDiyField', { Id: id, Name: field.Name, Type: field.Type, Component: field.Component, Label: field.Label, TableId: fixture.tableId, Tab: tab }, true);
        }
    };
    try {
        if (kind === 'designer') {
            await updateTable({ FormPresentationMode: 'Classic', TabsPosition: 'top', Tabs: [{ Id: 'basic', Name: '基础控件' }, { Id: 'groups', Name: '折叠/Tab分组' }] });
            await assignBaseTab('基础控件');
            for (const field of [
                { Name: 'TextExample', Label: '单行文本', Component: 'Text', Tab: '折叠/Tab分组', Sort: 10 },
                { Name: 'Tabs276', Label: 'Tabs276', Component: 'Tabs', Tab: '基础控件', FormWidth: 24, Sort: 11, Config: { Tabs: { Tabs: [{ Key: 'inner', Title: '页签内容', FieldNames: [] }], ScopeMode: 'Manual', CaptureRest: false } } },
                { Name: 'FileUpload20', Label: 'FileUpload20', Component: 'FileUpload', Tab: '基础控件', Sort: 12, Config: { FileUpload: { Limit: true } } },
                { Name: 'Autocomplete43', Label: 'Autocomplete43', Component: 'Autocomplete', Tab: '基础控件', Sort: 13, Config: { V8Code: '' } }
            ]) await addField(field);
        } else if (kind === 'employee') {
            await updateTable({ FormPresentationMode: 'Classic', TabsPosition: 'left', Tabs: [{ Id: 'employee', Name: '员工信息' }, { Id: 'extra', Name: '其他信息' }] });
            await assignBaseTab('员工信息');
            await addField({ Name: 'DateBirth', Label: '出生日期', Component: 'DateTime', Type: 'datetime', Tab: '员工信息', Sort: 10, Config: { DateTimeType: 'date' } });
            await addField({ Name: 'Regular', Label: '是否转正', Component: 'Radio', Tab: '员工信息', Sort: 11, Data: JSON.stringify(['是', '否']) });
            await fixture.call('FormEngine/UptFormData', { FormEngineKey: fixture.tableName, Id: fixture.recordId, _FormData: { DateBirth: '2000-01-02 00:00:00', Regular: '是' } });
        } else if (kind === 'contact') {
            await updateTable({ FormPresentationMode: 'ControlCenter', Tabs: [{ Id: 'contact', Name: '联系人' }], FormRecordSelectorLabelFields: 'Biaoti' });
            await assignBaseTab('联系人');
            const secondRecordId = randomUUID();
            await fixture.call('FormEngine/AddFormData', { FormEngineKey: fixture.tableName, Id: secondRecordId, _FormData: { Biaoti: fixture.recordTitle + '-2', Neirong: '<p>second owned contact</p>' } });
        } else if (kind === 'qrcode') {
            await addField({ Name: 'QrFixture', Label: '二维码', Component: 'Qrcode', Sort: 10, FormWidth: 24 });
            await updateTable({ InFormV8: `V8.FieldSet('QrFixture', 'DataAppend', { Code: '${fixture.owner}' });` });
        } else {
            throw new Error('Unknown form UI fixture kind.');
        }
        return fixture;
    } catch (error) {
        try { await fixture.cleanup(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Form UI fixture setup and cleanup failed.'); }
        throw error;
    }
}

export async function cleanupFormUiFixtures(fixtures) {
    const failures = [];
    for (const fixture of [...fixtures].reverse()) {
        try { await fixture.cleanup(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, 'Form UI fixture cleanup failed.');
}
