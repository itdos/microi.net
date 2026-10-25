// Owned by app.microi.sys-log. These are metadata contracts, not migration jobs.
const field = (name, label, type = 'varchar(160)', component = 'Text', extra = {}) => ({ name, label, type, component, ...extra });
const table = (name, description, fields, indexes) => ({
  name, description, readPrimary: 1, v8Limit: false,
  fields: [field('Tenant', '租户', 'varchar(50)', 'Text', { readonly: true }), ...fields], indexes,
});
const fact = (name, label, type = 'varchar(64)', component = 'Text') => field(name, label, type, component, { readonly: true });

export const policyFields = [
  field('FileServerBakThresholdGiB', '备用分流阈值（GiB）', 'decimal(18,6)', 'NumberText', {
    defaultValue: '', description: '每个受管资源在完整可信窗口内达到的实际流量；1 GiB=1073741824字节。留空或非正值不启用；缺流量证据不按0处理。仅声明配置，不自动复制或分流。',
  }),
  field('FileServerBakWindowHours', '备用分流统计窗口（小时）', 'int', 'NumberText', {
    defaultValue: '24', description: '完整统计窗口，默认24小时，允许1至720小时。历史榜单和不完整窗口不能冒充当前流量；仅FileServerBak有值且达阈值、可信副本Ready时才可分流。',
  }),
];

export default {
  ownerAppId: 'app.microi.sys-log', protocol: 'ManagedFileResource/1',
  runtimeRoutingEnabled: false, trustedCollectorsEnabled: false, replicaWorkersEnabled: false,
  tables: [
    table('mci_file_resource', '受管热点公开资源目录', [
      fact('ResourceKey', '稳定资源标识', 'varchar(120)'), field('Name', '资源名称'),
      fact('Kind', '资源类型', 'varchar(32)'), fact('AppId', '应用Id', 'varchar(36)'),
      fact('SourceFileId', '发布文件Id', 'varchar(36)'), fact('SourceTenant', '源租户', 'varchar(50)'), fact('SourceProvider', '主存储提供商', 'varchar(20)'),
      fact('ObjectKey', '公有对象键', 'varchar(1000)'), fact('ContentHash', '源SHA256'),
      fact('Size', '源字节数', 'bigint', 'NumberText'), fact('ContentType', '内容类型', 'varchar(128)'),
      fact('SourceRevision', '源版本摘要'), fact('AuthorityState', '源声明状态', 'varchar(24)'),
      fact('Visibility', '可见范围', 'varchar(12)'), field('Enabled', '纳入目录', 'int', 'Switch', { defaultValue: '1' }),
      fact('RowVersion', '并发版本', 'int', 'NumberText'),
    ], [{ name: 'ux_file_resource_key', columns: ['Tenant', 'ResourceKey'], unique: true }]),
    table('mci_file_traffic_window', '资源流量证据窗口（采集器待接入）', [
      fact('ResourceId', '资源Id', 'varchar(36)'), fact('VersionHash', '资源版本摘要'),
      fact('WindowStartUtc', '窗口起点UTC秒', 'bigint', 'NumberText'), fact('WindowEndUtc', '窗口终点UTC秒', 'bigint', 'NumberText'),
      fact('Metric', '计量口径', 'varchar(32)'), fact('Bytes', '实际字节（未知为空）', 'bigint', 'NumberText'),
      fact('Requests', '请求数（未知为空）', 'bigint', 'NumberText'), fact('DataSource', '数据来源', 'varchar(40)'),
      fact('CoverageScope', '覆盖范围', 'varchar(80)'), fact('CoverageComplete', '覆盖完整', 'int', 'Switch'),
      fact('EvidenceState', '证据状态', 'varchar(24)'), fact('ObservedThroughUtc', '覆盖到UTC秒', 'bigint', 'NumberText'),
      fact('CollectedAtUtc', '采集UTC秒', 'bigint', 'NumberText'), fact('FreshUntilUtc', '有效到UTC秒', 'bigint', 'NumberText'),
      fact('EvidenceHash', '证据摘要'), fact('RequestKey', '采集幂等键', 'varchar(100)'),
    ], [
      { name: 'ux_file_traffic_request', columns: ['Tenant', 'RequestKey'], unique: true },
      { name: 'ix_file_traffic_window', columns: ['Tenant', 'ResourceId', 'WindowEndUtc'] },
    ]),
    table('mci_file_replica', '热点资源备用副本回执（复制器待接入）', [
      fact('ResourceId', '资源Id', 'varchar(36)'), fact('SourceRevision', '源版本摘要'),
      fact('TargetConfigHash', '目标配置摘要'), fact('TargetObjectKey', '目标对象键', 'varchar(1000)'),
      fact('State', '副本状态', 'varchar(24)'), fact('VerifiedSize', '回读字节（未知为空）', 'bigint', 'NumberText'),
      fact('VerifiedSha256', '回读SHA256'), fact('VerifiedAtUtc', '验证UTC秒', 'bigint', 'NumberText'),
      fact('LastErrorCode', '错误代码', 'varchar(80)'), fact('RequestKey', '复制幂等键', 'varchar(100)'),
      fact('JobId', '持久任务Id', 'varchar(36)'), fact('LeaseOwner', '租约持有者', 'varchar(64)'),
      fact('FencingToken', '租约栅栏', 'bigint', 'NumberText'), fact('RowVersion', '并发版本', 'int', 'NumberText'),
    ], [
      { name: 'ux_file_replica_request', columns: ['Tenant', 'RequestKey'], unique: true },
      { name: 'ix_file_replica_resource', columns: ['Tenant', 'ResourceId', 'SourceRevision'] },
    ]),
  ],
  engines: [{ key: 'mci-file-resource-manager', ownership: 'Managed', allowAnonymous: false }],
  modules: [], scheduleJobs: [], dataSets: [],
};
