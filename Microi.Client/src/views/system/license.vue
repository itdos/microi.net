<template>
    <div class="license-page">
        <!-- 顶部横幅 -->
        <div class="license-header">
            <div class="header-content">
                <div class="header-icon">
                    <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.83-3.13 9.37-7 10.5-3.87-1.13-7-5.67-7-10.5V6.3l7-3.12zM11 7v2h2V7h-2zm0 4v6h2v-6h-2z"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h1>授权管理</h1>
                    <p>License Authorization Management</p>
                </div>
            </div>
        </div>

        <div class="license-body">
            <!-- 加载中 -->
            <div v-if="pageLoading" class="loading-wrap">
                <el-skeleton :rows="8" animated />
            </div>

            <template v-else>
                <el-alert
                    v-if="!isMainTenant"
                    type="info"
                    :closable="false"
                    show-icon
                    class="readonly-alert"
                >
                    <template #title>当前为子租户，授权管理处于只读模式</template>
                    当前租户 {{ currentOsClient }} 可查看本服务器的授权状态和完整授权信息；提交授权申请、重新验证、下载或自动部署 License 仅允许主租户 {{ mainOsClient }} 执行。
                </el-alert>

                <!-- ========== 已授权状态 ========== -->
                <el-card v-if="isLicensed" class="status-card status-licensed" shadow="hover">
                    <div class="status-row">
                        <div class="status-badge success">
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <span class="status-label success">已授权</span>
                        <el-tag :type="licenseInfo.ProductType === 'Enterprise' ? 'danger' : 'warning'" effect="dark" size="large">
                            {{ licenseInfo.ProductType === 'Enterprise' ? '企业版 Enterprise' : '个人版 Personal' }}
                        </el-tag>
                    </div>
                    <el-descriptions :column="2" border class="license-desc" :label-style="{ width: '140px', fontWeight: 600 }">
                        <el-descriptions-item label="授权公司">{{ licenseInfo.Company }}</el-descriptions-item>
                        <el-descriptions-item label="授权联系人">{{ licenseInfo.Name || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="联系电话">{{ licenseInfo.Phone || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="产品版本">
                            {{ licenseInfo.ProductType === 'Enterprise' ? '企业版 Enterprise' : '个人版 Personal' }}
                        </el-descriptions-item>
                        <el-descriptions-item label="硬件指纹 HID" :span="2">
                            <code class="hid-code">{{ licenseInfo.HID }}</code>
                        </el-descriptions-item>
                        <el-descriptions-item label="授权到期">{{ licenseInfo.ExpirationDate }}</el-descriptions-item>
                        <el-descriptions-item label="更新服务到期">{{ licenseInfo.UpdateExpirationDate || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="签发时间">{{ licenseInfo.IssuedDate }}</el-descriptions-item>
                        <el-descriptions-item label="License格式版本">v{{ licenseInfo.LicenseVersion || 1 }}</el-descriptions-item>
                        <el-descriptions-item label="在线AI授权">
                            <el-tag :type="licenseInfo.OnlineAiLicensed ? 'success' : 'info'" size="small">
                                {{ licenseInfo.OnlineAiLicensed ? '已授权' : '未授权' }}
                            </el-tag>
                            <span class="inline-info">{{ formatProductType(licenseInfo.AiProductType) }}</span>
                        </el-descriptions-item>
                        <el-descriptions-item label="当前 / 主租户">
                            {{ currentOsClient }} / {{ mainOsClient }}
                        </el-descriptions-item>
                        <el-descriptions-item label="授权组件版本">
                            {{ licenseInfo.LicenseProviderAssemblyVersion || '-' }}
                        </el-descriptions-item>
                        <el-descriptions-item label="Microi.AI版本">
                            {{ licenseInfo.MicroiAiAssemblyVersion || '-' }}
                        </el-descriptions-item>
                    </el-descriptions>
                    <div v-if="isMainTenant" class="card-actions">
                        <el-button type="primary" :loading="verifying" @click="refreshLicense">
                            <el-icon><Refresh /></el-icon> 重新验证
                        </el-button>
                    </div>
                </el-card>

                <!-- ========== 未授权状态 ========== -->
                <template v-else>
                    <!-- 状态提示 -->
                    <el-card class="status-card status-unlicensed" shadow="hover">
                        <div class="status-row">
                            <div class="status-badge warning">
                                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                            </div>
                            <span class="status-label warning">未授权</span>
                            <el-tag type="info" effect="dark" size="large">开源版 OpenSource</el-tag>
                        </div>
                        <p class="status-hint">
                            当前服务器未检测到有效的License授权，AI相关高级功能受限。
                            {{ isMainTenant ? '请提交授权申请或部署已签发的License文件。' : '当前子租户仅可查看状态，请联系主租户管理员处理授权。' }}
                        </p>
                    </el-card>

                    <!-- 已提交过申请的状态提示 -->
                    <el-card v-if="existingApp" class="status-card" shadow="hover" :style="{ borderTop: '3px solid ' + existingAppBorderColor }">
                        <div class="status-row">
                            <div class="status-badge" :class="existingAppBadgeClass">
                                <svg v-if="existingApp.Status === 'Issued'" viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                <svg v-else-if="existingApp.Status === 'Rejected'" viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                                <svg v-else viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                            </div>
                            <span class="status-label" :style="{ color: existingAppBorderColor }">
                                {{ existingApp.Status === 'Pending' ? '申请待审核' : existingApp.Status === 'Rejected' ? '申请已驳回' : existingApp.Status === 'Issued' ? (existingApp.Revoked ? 'License已作废' : 'License已签发') : '已提交申请' }}
                            </span>
                        </div>
                        <el-descriptions :column="2" border :label-style="{ width: '120px', fontWeight: 600 }">
                            <el-descriptions-item label="公司名称">{{ existingApp.Company }}</el-descriptions-item>
                            <el-descriptions-item label="联系人">{{ existingApp.Name }}</el-descriptions-item>
                            <el-descriptions-item label="联系电话">{{ existingApp.Phone }}</el-descriptions-item>
                            <el-descriptions-item label="产品版本">{{ existingApp.ProductType === 'Enterprise' ? '企业版' : '个人版' }}</el-descriptions-item>
                        </el-descriptions>
                        <el-alert v-if="existingApp.Status === 'Rejected' && existingApp.RejectReason" type="error" :closable="false" style="margin-top: 12px">
                            <template #title>驳回原因：{{ existingApp.RejectReason }}</template>
                        </el-alert>
                        <p v-if="existingApp.Status === 'Pending'" style="margin: 12px 0 0; color: #909399; font-size: 13px;">
                            您的申请正在等待管理员审核。{{ isMainTenant ? '您也可以修改信息后重新提交。' : '' }}
                        </p>
                        <p v-if="existingApp.Status === 'Issued' && !existingApp.Revoked" style="margin: 12px 0 0; color: #67c23a; font-size: 13px;">
                            {{ isMainTenant ? 'License已签发，请切换到「检查并部署License」选项卡进行部署。' : 'License已签发，请联系主租户管理员完成部署。' }}
                        </p>
                    </el-card>

                    <!-- 服务器信息 -->
                    <el-card class="info-card" shadow="hover">
                        <template #header>
                            <div class="card-title"><el-icon><Monitor /></el-icon> 当前服务器信息</div>
                        </template>
                        <el-descriptions :column="1" border :label-style="{ width: '140px', fontWeight: 600 }">
                            <el-descriptions-item label="硬件指纹 HID">
                                <div class="hid-row">
                                    <code class="hid-code">{{ hid || '获取中...' }}</code>
                                    <el-button v-if="hid" text type="primary" size="small" @click="copyText(hid)">
                                        <el-icon><CopyDocument /></el-icon> 复制
                                    </el-button>
                                </div>
                            </el-descriptions-item>
                        </el-descriptions>
                    </el-card>

                    <!-- 主操作区：Tabs -->
                    <el-card v-if="isMainTenant" class="main-card" shadow="hover">
                        <el-tabs v-model="activeTab" type="border-card" @tab-change="onTabChange">
                            <!-- TAB 1: 提交申请 -->
                            <el-tab-pane name="apply">
                                <template #label>
                                    <span><el-icon><EditPen /></el-icon> 提交授权申请</span>
                                </template>
                                <el-form :model="applyForm" label-width="130px" class="apply-form" @submit.prevent>
                                    <el-form-item label="硬件指纹 HID">
                                        <el-input :model-value="hid" disabled>
                                            <template #append>
                                                <el-button @click="copyText(hid)">复制</el-button>
                                            </template>
                                        </el-input>
                                    </el-form-item>
                                    <el-row :gutter="20">
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="授权账号" required>
                                                <el-input v-model="applyForm.Account" placeholder="平台账号" clearable />
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="授权密码" required>
                                                <el-input v-model="applyForm.Password" type="password" placeholder="平台密码" show-password clearable />
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-row :gutter="20">
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="公司名称" required>
                                                <el-input v-model="applyForm.Company" placeholder="贵公司名称" clearable />
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="联系人" required>
                                                <el-input v-model="applyForm.Name" placeholder="联系人姓名" clearable />
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-row :gutter="20">
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="联系电话" required>
                                                <el-input v-model="applyForm.Phone" placeholder="联系电话" clearable />
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-row :gutter="20">
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="验证码" required>
                                                <div style="display:flex;gap:8px;align-items:center;width:100%">
                                                    <el-input v-model="applyForm.CaptchaValue" placeholder="请输入验证码计算结果" maxlength="6" clearable style="flex:1" @keyup.enter="submitApply" />
                                                    <img v-if="captchaSrc" :src="captchaSrc" class="captcha-img" @click="loadCaptcha" title="点击刷新验证码" style="height:40px;cursor:pointer;border:1px solid #dcdfe6;border-radius:4px" />
                                                    <el-button v-else size="small" @click="loadCaptcha">获取验证码</el-button>
                                                </div>
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-form-item label="备注">
                                        <el-input v-model="applyForm.Remark" type="textarea" :rows="3" placeholder="附加说明" />
                                    </el-form-item>
                                    <el-form-item>
                                        <el-button type="primary" size="default" :loading="applying" @click="submitApply">
                                            <el-icon><Promotion /></el-icon> {{ existingApp ? '重新提交申请' : '提交授权申请' }}
                                        </el-button>
                                    </el-form-item>
                                </el-form>
                            </el-tab-pane>

                            <!-- TAB 2: 检查 & 部署 -->
                            <el-tab-pane name="deploy">
                                <template #label>
                                    <span><el-icon><Download /></el-icon> 检查并部署License</span>
                                </template>
                                <div class="deploy-section">
                                    <p class="deploy-hint">已提交授权申请？在此检查License签发状态。签发完成后可一键部署到当前服务器或下载License文件。</p>
                                    <el-button type="primary" size="default" :loading="checking" @click="checkLicense">
                                        <el-icon><Search /></el-icon> 检查授权状态
                                    </el-button>

                                    <!-- 检查结果 -->
                                    <div v-if="checkResult !== null" class="check-result">
                                        <!-- 已作废 -->
                                        <el-alert v-if="checkResult.Revoked" type="error" :closable="false" show-icon class="result-alert">
                                            <template #title><strong>该License已被作废</strong></template>
                                            此HID的授权已被管理员作废，如有疑问请联系 Microi 官方。
                                        </el-alert>
                                        <!-- 已驳回 -->
                                        <el-alert v-else-if="checkResult.Status === 'Rejected'" type="error" :closable="false" show-icon class="result-alert">
                                            <template #title><strong>授权申请已被驳回</strong></template>
                                            <div>
                                                <p style="margin:4px 0">驳回原因：<strong>{{ checkResult.RejectReason || '未填写' }}</strong></p>
                                                <p style="margin:4px 0;color:#999">您可以重新提交授权申请。</p>
                                            </div>
                                        </el-alert>
                                        <!-- 待审核 -->
                                        <el-alert v-else-if="checkResult.Status === 'Pending'" type="info" :closable="false" show-icon class="result-alert">
                                            <template #title><strong>授权申请待审核</strong></template>
                                            您的申请已提交，正在等待管理员审核，请耐心等待。
                                        </el-alert>
                                        <!-- 未签发（无LicenseContent且无Status） -->
                                        <el-alert v-else-if="!checkResult.HasLicense" type="warning" :closable="false" show-icon class="result-alert">
                                            <template #title><strong>License尚未签发</strong></template>
                                            您的申请已记录，管理员尚未完成签发，请耐心等待。
                                        </el-alert>
                                        <!-- 可以部署 -->
                                        <template v-else>
                                            <el-alert type="success" :closable="false" show-icon class="result-alert">
                                                <template #title><strong>License已签发，可以部署！</strong></template>
                                                <span>
                                                    授权公司: <strong>{{ checkResult.Company }}</strong>
                                                    &ensp;|&ensp;产品版本: <strong>{{ checkResult.ProductType === 'Enterprise' ? '企业版' : '个人版' }}</strong>
                                                    &ensp;|&ensp;到期时间: <strong>{{ checkResult.ExpirationDate }}</strong>
                                                </span>
                                            </el-alert>
                                            <div class="deploy-actions">
                                                <el-button type="success" size="default" :loading="deploying" @click="deployLicense">
                                                    <el-icon><Upload /></el-icon> 自动部署到服务器
                                                </el-button>
                                                <el-button size="default" @click="downloadLicense">
                                                    <el-icon><Download /></el-icon> 下载 microi.net.lic 文件
                                                </el-button>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </el-tab-pane>
                        </el-tabs>
                    </el-card>
                </template>

                <el-card class="info-card license-server-card" shadow="hover">
                    <template #header>
                        <div class="card-title server-title">
                            <span><el-icon><Connection /></el-icon> 已部署服务器节点</span>
                            <el-button v-if="isMainTenant" link type="primary" :loading="licenseServersLoading" @click="loadLicenseServers">刷新</el-button>
                        </div>
                    </template>
                    <el-table
                        v-loading="licenseServersLoading"
                        :data="licenseServers"
                        size="small"
                        border
                        empty-text="暂无服务器授权记录"
                    >
                        <el-table-column label="当前" width="72" align="center">
                            <template #default="{ row }">
                                <el-tag v-if="row.HID === hid" type="success" size="small">当前</el-tag>
                                <span v-else class="server-dot"></span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="ServerName" label="服务器" min-width="150" show-overflow-tooltip />
                        <el-table-column prop="HID" label="HID" min-width="220" show-overflow-tooltip />
                        <el-table-column prop="ProductType" label="授权类型" width="120" />
                        <el-table-column prop="Company" label="授权主体" min-width="160" show-overflow-tooltip />
                        <el-table-column prop="IpAddress" label="服务器IP" min-width="150" show-overflow-tooltip />
                        <el-table-column prop="ExpirationDate" label="授权到期" min-width="160" />
                        <el-table-column prop="LastDeployTime" label="最后部署" min-width="160" />
                        <el-table-column prop="LastRestoreTime" label="最后恢复" min-width="160" />
                        <el-table-column prop="Status" label="状态" width="110" />
                    </el-table>
                </el-card>
            </template>
        </div>
    </div>
</template>

<script>
import { Refresh, Monitor, CopyDocument, EditPen, Promotion, Search, Download, Upload, Connection } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";

const LICENSE_API_BASE = "https://api.itdos.com";

export default {
    name: "system_license",
    components: { Refresh, Monitor, CopyDocument, EditPen, Promotion, Search, Download, Upload, Connection },
    data() {
        return {
            pageLoading: true,
            verifying: false,
            applying: false,
            checking: false,
            deploying: false,
            // 授权信息
            hid: "",
            isLicensed: false,
            licenseInfo: {},
            isMainTenant: false,
            currentOsClient: "",
            mainOsClient: "",
            // 申请表单
            activeTab: "apply",
            applyForm: {
                Account: "",
                Password: "",
                Company: "",
                Name: "",
                Phone: "",
                CaptchaValue: "",
                Remark: "",
            },
            // 验证码
            captchaId: "",
            captchaSrc: "",
            // 已提交的申请记录（从License服务器查询）
            existingApp: null,
            // 检查结果
            checkResult: null,
            licenseServers: [],
            licenseServersLoading: false,
        };
    },
    mounted() {
        this.init();
    },
    computed: {
        existingAppBorderColor() {
            if (!this.existingApp) return '#909399';
            const s = this.existingApp.Status;
            if (s === 'Issued' && !this.existingApp.Revoked) return '#67c23a';
            if (s === 'Rejected' || this.existingApp.Revoked) return '#f56c6c';
            if (s === 'Pending') return '#409eff';
            return '#909399';
        },
        existingAppBadgeClass() {
            if (!this.existingApp) return '';
            const s = this.existingApp.Status;
            if (s === 'Issued' && !this.existingApp.Revoked) return 'success';
            if (s === 'Rejected' || this.existingApp.Revoked) return 'danger';
            return 'info';
        },
    },
    methods: {
        async init() {
            this.pageLoading = true;
            const self = this;
            this.loadVerify(() => {
                self.pageLoading = false;
                self.loadLicenseServers();
                // 如果未授权，向License服务器查询是否已提交过申请
                if (!self.isLicensed && self.hid) {
                    self.queryExistingApplication();
                    if (self.isMainTenant) {
                        self.loadCaptcha();
                    }
                }
            });
        },

        // 读取当前登录租户可见的完整 License 管理状态
        loadVerify(done) {
            const self = this;
            self.verifying = true;
            self.DiyCommon.Get("/api/License/GetManagementState", {}, function (result) {
                self.verifying = false;
                if (result && result.Code === 1 && result.Data) {
                    const d = result.Data;
                    self.isLicensed = d.IsLicensed === true;
                    self.isMainTenant = d.IsMainTenant === true;
                    self.currentOsClient = d.CurrentOsClient || "";
                    self.mainOsClient = d.MainOsClient || "";
                    self.licenseInfo = {
                        HID: d.HID || self.hid,
                        ProductType: d.ProductType || "",
                        Company: d.Company || "",
                        Name: d.Name || "",
                        Phone: d.Phone || "",
                        ExpirationDate: d.ExpirationDate || "",
                        UpdateExpirationDate: d.UpdateExpirationDate || "",
                        IssuedDate: d.IssuedDate || "",
                        LicenseVersion: d.LicenseVersion || 1,
                        OnlineAiLicensed: d.OnlineAiLicensed === true,
                        AiProductType: d.AiProductType || "OpenSource",
                        LicenseProviderAssemblyVersion: d.LicenseProviderAssemblyVersion || "",
                        MicroiAiAssemblyVersion: d.MicroiAiAssemblyVersion || "",
                    };
                    self.hid = d.HID || self.hid;
                } else {
                    self.isLicensed = false;
                    ElMessage.error((result && result.Msg) || "授权状态读取失败");
                }
                if (done) done();
            }, function () {
                self.verifying = false;
                self.isLicensed = false;
                if (done) done();
            });
        },

        // 主租户重新加载并验证本机 License 文件
        refreshLicense() {
            if (!this.ensureMainTenant()) return;
            const self = this;
            self.verifying = true;
            self.DiyCommon.Post("/api/License/RefreshCurrentServer", {}, function (result) {
                self.verifying = false;
                if (result && result.Code === 1) {
                    ElMessage.success(result.Msg || "License已重新验证");
                    self.loadVerify();
                } else {
                    ElMessage.error((result && result.Msg) || "License重新验证失败");
                }
            }, function () {
                self.verifying = false;
                ElMessage.error("License重新验证请求失败");
            });
        },

        // 查询License服务器上是否已有该HID的申请记录
        queryExistingApplication() {
            const self = this;
            fetch(LICENSE_API_BASE + "/api/License/QueryApplication", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ HID: self.hid }),
            })
                .then(r => r.json())
                .then(result => {
                    if (result && result.Code === 1 && result.Data && result.Data.HasApplication) {
                        self.existingApp = result.Data;
                        // 预填表单
                        if (result.Data.Company) self.applyForm.Company = result.Data.Company;
                        if (result.Data.Name) self.applyForm.Name = result.Data.Name;
                        if (result.Data.Phone) self.applyForm.Phone = result.Data.Phone;
                        if (result.Data.Remark) self.applyForm.Remark = result.Data.Remark;
                        // 如果已签发且未作废，自动切换到部署tab并获取LicenseContent
                        if (self.isMainTenant && result.Data.Status === 'Issued' && !result.Data.Revoked) {
                            self.activeTab = "deploy";
                            self.checkLicense();
                        }
                    }
                })
                .catch(() => { /* 静默失败，不影响正常使用 */ });
        },

        // 读取当前主租户中已经部署过License的服务器节点
        async loadLicenseServers() {
            const self = this;
            self.licenseServersLoading = true;
            try {
                await new Promise((resolve) => {
                    self.DiyCommon.Get("/api/License/GetServerNodes", {}, function (result) {
                        self.licenseServers = result && result.Code === 1 && Array.isArray(result.Data)
                            ? result.Data
                            : [];
                        resolve();
                    }, function () {
                        self.licenseServers = [];
                        resolve();
                    });
                });
            } catch (error) {
                self.licenseServers = [];
            } finally {
                self.licenseServersLoading = false;
            }
        },

        // Tab切换事件
        onTabChange(name) {
            if (!this.isMainTenant) return;
            if (name === "deploy" && this.hid && this.checkResult === null) {
                this.checkLicense();
            }
        },

        // 加载验证码（从License服务器）
        loadCaptcha() {
            if (!this.ensureMainTenant(false)) return;
            const self = this;
            fetch(LICENSE_API_BASE + "/api/License/GetCaptcha", { method: "GET" })
                .then(r => r.json())
                .then(result => {
                    if (result && result.Code === 1 && result.Data) {
                        self.captchaId = result.Data.CaptchaId || "";
                        self.captchaSrc = "data:image/gif;base64," + result.Data.Image;
                    } else {
                        ElMessage.warning("获取验证码失败，请重试");
                    }
                })
                .catch(() => {
                    ElMessage.error("获取验证码失败，请检查网络连接");
                });
        },

        // 通过本机受保护接口向 License 服务提交申请
        submitApply() {
            const self = this;
            if (!self.ensureMainTenant()) return;
            if (!self.hid) {
                ElMessage.warning("HID获取失败，请刷新页面重试");
                return;
            }
            if (!self.applyForm.Account.trim()) {
                ElMessage.warning("请填写授权账号");
                return;
            }
            if (!self.applyForm.Password) {
                ElMessage.warning("请填写授权密码");
                return;
            }
            if (!self.applyForm.Company.trim()) {
                ElMessage.warning("请填写公司名称");
                return;
            }
            if (!self.applyForm.Name.trim()) {
                ElMessage.warning("请填写联系人");
                return;
            }
            if (!self.applyForm.Phone.trim()) {
                ElMessage.warning("请填写联系电话");
                return;
            }
            if (!self.applyForm.CaptchaValue.trim()) {
                ElMessage.warning("请输入验证码");
                return;
            }
            if (!self.captchaId) {
                ElMessage.warning("请先获取验证码");
                return;
            }

            self.applying = true;
            const param = {
                HID: self.hid,
                Account: self.applyForm.Account.trim(),
                Password: self.applyForm.Password,
                Company: self.applyForm.Company.trim(),
                Name: self.applyForm.Name.trim(),
                Phone: self.applyForm.Phone.trim(),
                CaptchaId: self.captchaId,
                CaptchaValue: self.applyForm.CaptchaValue.trim(),
                Remark: self.applyForm.Remark.trim(),
            };

            self.DiyCommon.Post("/api/License/ApplyCurrentServer", param, function (result) {
                self.applying = false;
                if (result && result.Code === 1) {
                    if (result.Data && result.Data.LicenseContent) {
                        ElMessage.success(result.Msg || "License已自动签发！");
                        self.checkResult = result.Data;
                        self.activeTab = "deploy";
                    } else {
                        ElMessage.success(result.Msg || "授权申请已提交，等待管理员审核");
                        self.queryExistingApplication();
                        self.activeTab = "deploy";
                    }
                    // 重置验证码
                    self.applyForm.CaptchaValue = "";
                    self.loadCaptcha();
                } else {
                    ElMessage.error((result && result.Msg) || "申请提交失败");
                    // 验证码可能已失效，刷新验证码
                    self.loadCaptcha();
                    self.applyForm.CaptchaValue = "";
                }
            }, function () {
                self.applying = false;
                ElMessage.error("网络请求失败，请检查网络连接");
                self.loadCaptcha();
                self.applyForm.CaptchaValue = "";
            });
        },

        // 检查授权状态（从 api.itdos.com，不发送authorization报文）
        checkLicense() {
            const self = this;
            if (!self.ensureMainTenant()) return;
            if (!self.hid) {
                ElMessage.warning("HID获取失败，请刷新页面重试");
                return;
            }

            self.checking = true;
            self.checkResult = null;

            fetch(LICENSE_API_BASE + "/api/License/Check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ HID: self.hid }),
            })
                .then(r => r.json())
                .then(result => {
                    self.checking = false;
                    if (result && result.Code === 1 && result.Data) {
                        self.checkResult = result.Data;
                    } else {
                        ElMessage.warning((result && result.Msg) || "未找到License记录");
                    }
                })
                .catch(() => {
                    self.checking = false;
                    ElMessage.error("网络请求失败，请检查网络连接");
                });
        },

        // 自动部署到本地服务器
        deployLicense() {
            const self = this;
            if (!self.ensureMainTenant()) return;
            if (!self.checkResult || !self.checkResult.LicenseContent) {
                ElMessage.warning("无可用的License内容");
                return;
            }

            ElMessageBox.confirm(
                "即将将License文件写入当前服务器并自动验证。确定继续？",
                "部署确认",
                { type: "info", confirmButtonText: "确定部署", cancelButtonText: "取消" }
            ).then(() => {
                self.deploying = true;
                self.DiyCommon.Post("/api/License/WriteLicenseFile", {
                    LicenseContent: self.checkResult.LicenseContent,
                }, function (result) {
                    self.deploying = false;
                    if (result && result.Code === 1) {
                        ElMessage.success(result.Msg || "License已成功部署！");
                        // 刷新验证状态
                        self.checkResult = null;
                        self.loadVerify(() => {
                            self.loadLicenseServers();
                        });
                    } else {
                        ElMessage.error((result && result.Msg) || "部署失败");
                    }
                }, function () {
                    self.deploying = false;
                    ElMessage.error("部署请求失败");
                });
            }).catch(() => {});
        },

        // 下载License文件
        downloadLicense() {
            if (!this.ensureMainTenant()) return;
            if (!this.checkResult || !this.checkResult.LicenseContent) {
                ElMessage.warning("无可用的License内容");
                return;
            }
            const blob = new Blob([this.checkResult.LicenseContent], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "microi.net.lic";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            ElMessage.success("License文件下载成功");
        },

        ensureMainTenant(showMessage = true) {
            if (this.isMainTenant) return true;
            if (showMessage) {
                ElMessage.warning("当前为子租户，仅主租户可以执行授权管理操作");
            }
            return false;
        },

        formatProductType(productType) {
            if (productType === "Enterprise") return "企业版 Enterprise";
            if (productType === "Personal") return "个人版 Personal";
            return "开源版 OpenSource";
        },

        // 复制文本
        copyText(text) {
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                ElMessage.success("已复制到剪贴板");
            }).catch(() => {
                // Fallback
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.left = "-9999px";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                ElMessage.success("已复制到剪贴板");
            });
        },
    },
};
</script>

<style scoped lang="scss">
.license-page {
    min-height: 100vh;
    background: #f0f2f5;
}

/* ===== 顶部横幅 ===== */
.license-header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
    padding: 40px 0;
    color: #fff;
    border-bottom: 3px solid #e94560;
}
.header-content {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 24px;
}
.header-icon {
    width: 72px;
    height: 72px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e94560;
    flex-shrink: 0;
    border: 1px solid rgba(233, 69, 96, 0.3);
}
.header-text h1 {
    margin: 0 0 4px;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 1px;
}
.header-text p {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 2px;
    text-transform: uppercase;
}

/* ===== 主体区域 ===== */
.license-body {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px;
}
.loading-wrap {
    padding: 40px;
    background: #fff;
    border-radius: 8px;
}

/* ===== 状态卡片 ===== */
.status-card {
    margin-bottom: 20px;
    border-radius: 8px;
}
.status-card.status-licensed {
    border-top: 3px solid #52c41a;
}
.status-card.status-unlicensed {
    border-top: 3px solid #faad14;
}
.status-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
}
.status-badge {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.status-badge.success {
    background: #f6ffed;
    color: #52c41a;
}
.status-badge.warning {
    background: #fffbe6;
    color: #faad14;
}
.status-badge.danger {
    background: #fef0f0;
    color: #f56c6c;
}
.status-badge.info {
    background: #ecf5ff;
    color: #409eff;
}
.status-label {
    font-size: 22px;
    font-weight: 700;
}
.status-label.success { color: #52c41a; }
.status-label.warning { color: #faad14; }
.status-hint {
    margin: 0;
    color: #666;
    font-size: 13px;
    line-height: 1.8;
}

/* ===== HID ===== */
.hid-code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    background: #f5f5f5;
    padding: 4px 10px;
    border-radius: 4px;
    color: #333;
    word-break: break-all;
    letter-spacing: 0.5px;
}
.hid-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* ===== 通用 ===== */
.card-title {
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}
.card-actions {
    margin-top: 20px;
    text-align: right;
}
.license-desc {
    margin-top: 4px;
}
.info-card {
    margin-bottom: 20px;
}
.readonly-alert {
    margin-bottom: 20px;
}
.inline-info {
    margin-left: 8px;
    color: #606266;
}
.license-server-card {
    :deep(.el-card__header) {
        padding: 14px 18px;
    }
}
.server-title {
    justify-content: space-between;
}
.server-title > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.server-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #dcdfe6;
}
.main-card {
    margin-bottom: 20px;
}

/* ===== 申请表单 ===== */
.apply-form {
    padding: 16px 8px 0;
}

/* ===== 部署区域 ===== */
.deploy-section {
    padding: 16px 8px 0;
}
.deploy-hint {
    color: #666;
    font-size: 13px;
    margin: 0 0 20px;
    line-height: 1.8;
}
.check-result {
    margin-top: 24px;
}
.result-alert {
    margin-bottom: 16px;
}
.deploy-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
}

/* ===== Element Plus 覆盖 ===== */
:deep(.el-tabs--border-card) {
    border-radius: 4px;
    border: none;
    box-shadow: none;
}
:deep(.el-tabs__header) {
    background: #fafafa;
}
:deep(.el-descriptions__label) {
    background: #fafafa;
}
</style>
