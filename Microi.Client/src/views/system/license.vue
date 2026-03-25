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
                        <el-descriptions-item label="产品版本">
                            {{ licenseInfo.ProductType === 'Enterprise' ? '企业版 Enterprise' : '个人版 Personal' }}
                        </el-descriptions-item>
                        <el-descriptions-item label="硬件指纹 HID" :span="2">
                            <code class="hid-code">{{ licenseInfo.HID }}</code>
                        </el-descriptions-item>
                        <el-descriptions-item label="授权到期">{{ licenseInfo.ExpirationDate }}</el-descriptions-item>
                        <el-descriptions-item label="签发时间">{{ licenseInfo.IssuedDate }}</el-descriptions-item>
                    </el-descriptions>
                    <div class="card-actions">
                        <el-button type="primary" :loading="verifying" @click="loadVerify">
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
                        <p class="status-hint">当前服务器未检测到有效的License授权，AI相关高级功能受限。请提交授权申请或部署已签发的License文件。</p>
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
                    <el-card class="main-card" shadow="hover">
                        <el-tabs v-model="activeTab" type="border-card">
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
                                                <el-input v-model="applyForm.Account" placeholder="Microi平台账号" clearable />
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="授权密码" required>
                                                <el-input v-model="applyForm.Password" type="password" placeholder="Microi平台密码" show-password clearable />
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
                                            <el-form-item label="服务器IP">
                                                <el-input v-model="applyForm.IP" placeholder="部署服务器的公网IP" clearable />
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-row :gutter="20">
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="联系人" required>
                                                <el-input v-model="applyForm.Name" placeholder="联系人姓名" clearable />
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <el-form-item label="联系电话" required>
                                                <el-input v-model="applyForm.Phone" placeholder="联系电话" clearable />
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-form-item label="产品类型" required>
                                        <el-radio-group v-model="applyForm.ProductType">
                                            <el-radio-button label="Personal">个人版 Personal</el-radio-button>
                                            <el-radio-button label="Enterprise">企业版 Enterprise</el-radio-button>
                                        </el-radio-group>
                                    </el-form-item>
                                    <el-form-item label="备注">
                                        <el-input v-model="applyForm.Remark" type="textarea" :rows="3" placeholder="附加说明" />
                                    </el-form-item>
                                    <el-form-item>
                                        <el-button type="primary" size="large" :loading="applying" @click="submitApply">
                                            <el-icon><Promotion /></el-icon> 提交授权申请
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
                                    <el-button type="primary" size="large" :loading="checking" @click="checkLicense">
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
                                                <el-button type="success" size="large" :loading="deploying" @click="deployLicense">
                                                    <el-icon><Upload /></el-icon> 自动部署到服务器
                                                </el-button>
                                                <el-button size="large" @click="downloadLicense">
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
            </template>
        </div>
    </div>
</template>

<script>
import { Refresh, Monitor, CopyDocument, EditPen, Promotion, Search, Download, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";

const LICENSE_API_BASE = "https://api.itdos.com";

export default {
    name: "system_license",
    components: { Refresh, Monitor, CopyDocument, EditPen, Promotion, Search, Download, Upload },
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
            // 申请表单
            activeTab: "apply",
            applyForm: {
                Account: "",
                Password: "",
                Company: "",
                Name: "",
                Phone: "",
                IP: "",
                ProductType: "Enterprise",
                Remark: "",
            },
            // 检查结果
            checkResult: null,
        };
    },
    mounted() {
        this.init();
    },
    methods: {
        async init() {
            this.pageLoading = true;
            // 先获取HID，再验证License
            this.loadHID(() => {
                this.loadVerify(() => {
                    this.pageLoading = false;
                });
            });
        },

        // 获取本机HID
        loadHID(done) {
            const self = this;
            self.DiyCommon.Get("/api/License/GetHardwareId", {}, function (result) {
                if (result && result.Code === 1 && result.Data) {
                    self.hid = result.Data.HID || "";
                }
                if (done) done();
            });
        },

        // 验证本机License状态
        loadVerify(done) {
            const self = this;
            self.verifying = true;
            self.DiyCommon.Get("/api/License/Verify", {}, function (result) {
                self.verifying = false;
                if (result && result.Code === 1 && result.Data) {
                    const d = result.Data;
                    self.isLicensed = d.IsLicensed === true;
                    self.licenseInfo = {
                        HID: d.HID || self.hid,
                        ProductType: d.ProductType || "",
                        Company: d.Company || "",
                        ExpirationDate: d.ExpirationDate || "",
                        IssuedDate: d.IssuedDate || "",
                    };
                    if (!self.hid) self.hid = d.HID || "";
                } else {
                    self.isLicensed = false;
                }
                if (done) done();
            });
        },

        // 提交申请到 api.itdos.com
        submitApply() {
            const self = this;
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
            if (!self.applyForm.ProductType) {
                ElMessage.warning("请选择产品类型");
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
                IP: self.applyForm.IP.trim(),
                ProductType: self.applyForm.ProductType,
                Remark: self.applyForm.Remark.trim(),
            };

            self.DiyCommon.Post(LICENSE_API_BASE + "/api/License/Apply", param, function (result) {
                self.applying = false;
                if (result && result.Code === 1) {
                    // 检查是否自动签发（返回了 LicenseContent）
                    if (result.Data && result.Data.LicenseContent) {
                        ElMessage.success(result.Msg || "License已自动签发！");
                        self.checkResult = result.Data;
                        self.activeTab = "deploy";
                    } else {
                        ElMessage.success(result.Msg || "授权申请已提交，等待管理员审核");
                        self.activeTab = "deploy";
                    }
                } else {
                    ElMessage.error((result && result.Msg) || "申请提交失败");
                }
            }, function () {
                self.applying = false;
                ElMessage.error("网络请求失败，请检查网络连接");
            });
        },

        // 检查授权状态（从 api.itdos.com）
        checkLicense() {
            const self = this;
            if (!self.hid) {
                ElMessage.warning("HID获取失败，请刷新页面重试");
                return;
            }

            self.checking = true;
            self.checkResult = null;

            self.DiyCommon.Post(LICENSE_API_BASE + "/api/License/Check", { HID: self.hid }, function (result) {
                self.checking = false;
                if (result && result.Code === 1 && result.Data) {
                    self.checkResult = result.Data;
                } else {
                    ElMessage.warning((result && result.Msg) || "未找到License记录");
                }
            }, function () {
                self.checking = false;
                ElMessage.error("网络请求失败，请检查网络连接");
            });
        },

        // 自动部署到本地服务器
        deployLicense() {
            const self = this;
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
                        self.loadVerify();
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
    max-width: 960px;
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
    max-width: 960px;
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
.status-label {
    font-size: 22px;
    font-weight: 700;
}
.status-label.success { color: #52c41a; }
.status-label.warning { color: #faad14; }
.status-hint {
    margin: 0;
    color: #666;
    font-size: 14px;
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
    font-size: 14px;
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
