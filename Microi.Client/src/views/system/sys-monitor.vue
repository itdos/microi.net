<template>
    <div class="sys-monitor pluginPage">
        <!-- 顶部标题栏 -->
        <div class="monitor-header">
            <div class="header-banner">
                <div class="banner-left">
                    <div class="banner-icon">
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.3">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="banner-text">
                        <div class="banner-title">系统监控中心</div>
                        <div class="banner-sub">System Monitor · Real-time</div>
                    </div>
                    <div class="edition-badge" :class="'edition-' + editionClass">{{ productEdition }}</div>
                    <el-tag effect="dark" :type="isDocker ? 'success' : 'info'" size="small" class="env-tag">{{ isDocker ? 'Docker' : osType }}</el-tag>
                </div>
                <div class="banner-right">
                    <!-- 双时钟 -->
                    <div class="clock-box">
                        <div class="clock-row"><span class="clock-lbl">服务器</span><span class="clock-val" :class="{ 'clock-warn': timeDiffWarn }">{{ serverTimeDisplay }}</span></div>
                        <div class="clock-row"><span class="clock-lbl">本 地</span><span class="clock-val">{{ localTimeDisplay }}</span></div>
                    </div>
                    <div class="banner-sep"></div>
                    <!-- 版本上下排列 -->
                    <div class="version-stack">
                        <span class="ver-line" v-if="backendVersion">后端 v{{ backendVersion }}</span>
                        <span class="ver-line">前端 v{{ frontendVersion }}</span>
                    </div>
                    <div class="banner-sep"></div>
                    <!-- 刷新状态 -->
                    <div class="refresh-info">
                        <span class="refresh-label">刷新间隔 5s</span>
                        <span class="refresh-ts" v-if="lastUpdateTs">{{ lastUpdateTs }}</span>
                    </div>
                    <el-tooltip content="自动刷新 (5s)">
                        <el-switch v-model="autoRefresh" @change="toggleAutoRefresh" size="small" />
                    </el-tooltip>
                    <el-button :icon="Refresh" circle size="small" @click="loadAll" :loading="loading" class="refresh-btn" />
                </div>
            </div>
        </div>

        <!-- 第一行：3个仪表盘(各25%) + 运行时间(25%) -->
        <el-row :gutter="10" class="section-row">
            <el-col :span="6" :sm="6" :xs="12">
                <div class="gauge-card">
                    <div ref="cpuChart" class="gauge-chart"></div>
                    <div class="gauge-label">CPU</div>
                    <div class="gauge-sub">{{ processorCount }} 核心</div>
                </div>
            </el-col>
            <el-col :span="6" :sm="6" :xs="12">
                <div class="gauge-card">
                    <div ref="memChart" class="gauge-chart"></div>
                    <div class="gauge-label">内存</div>
                    <div class="gauge-sub">{{ memUsedMB }} / {{ memTotalMB }} MB</div>
                </div>
            </el-col>
            <el-col :span="6" :sm="6" :xs="12">
                <div class="gauge-card">
                    <div ref="diskChart" class="gauge-chart"></div>
                    <div class="gauge-label">磁盘</div>
                    <div class="gauge-sub">{{ diskUsed }} / {{ diskTotal }} GB</div>
                </div>
            </el-col>
            <el-col :span="6" :sm="6" :xs="12">
                <div class="neon-card uptime-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        运行时间
                    </div>
                    <div class="uptime-value">{{ uptime }}</div>
                    <div class="uptime-sub">进程 {{ runningTime }}</div>
                    <div class="info-mini-grid">
                        <div class="mini-item"><span class="mini-label">PID</span><span class="mini-val">{{ processId }}</span></div>
                        <div class="mini-item"><span class="mini-label">线程</span><span class="mini-val">{{ threadCount }}</span></div>
                        <div class="mini-item"><span class="mini-label">进程内存</span><span class="mini-val">{{ processMemory }}MB</span></div>
                        <div class="mini-item"><span class="mini-label">GC内存</span><span class="mini-val">{{ gcMemory }}MB</span></div>
                    </div>
                </div>
            </el-col>
        </el-row>

        <!-- 第二行：运行环境(50%) + 平台统计(50%) -->
        <el-row :gutter="10" class="section-row">
            <el-col :span="12" :sm="12">
                <div class="neon-card env-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                        运行环境
                    </div>
                    <div class="env-grid">
                        <div class="env-item"><span class="env-lbl">操作系统</span><span class="env-val">{{ distroName || osType }}</span></div>
                        <div class="env-item"><span class="env-lbl">内核版本</span><span class="env-val">{{ kernelVersion || '-' }}</span></div>
                        <div class="env-item"><span class="env-lbl">主机名</span><span class="env-val">{{ machineName }}</span></div>
                        <div class="env-item"><span class="env-lbl">.NET</span><span class="env-val">{{ runtimeVersion }}</span></div>
                        <div class="env-item"><span class="env-lbl">GC回收</span><span class="env-val">G0:{{ gen0 }} G1:{{ gen1 }} G2:{{ gen2 }}</span></div>
                        <div class="env-item" v-if="loadAvg1"><span class="env-lbl">系统负载</span><span class="env-val">{{ loadAvg1 }} / {{ loadAvg5 }} / {{ loadAvg15 }}</span></div>
                    </div>
                </div>
            </el-col>
            <el-col :span="12" :sm="12">
                <div class="stat-cards-wrap">
                    <div class="stat-card" v-for="s in platformStatCards" :key="s.key">
                        <div class="stat-icon" :style="{ background: s.bg }">
                            <svg v-html="s.icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
                        </div>
                        <div class="stat-num">{{ s.value }}</div>
                        <div class="stat-label">{{ s.label }}</div>
                    </div>
                </div>
            </el-col>
        </el-row>

        <!-- 第三行：CPU/内存趋势(50%) + 网络趋势(50%) -->
        <el-row :gutter="10" class="section-row">
            <el-col :span="12" :sm="12">
                <div class="neon-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        CPU / 内存趋势
                    </div>
                    <div ref="trendChart" class="chart-area" style="height:180px"></div>
                </div>
            </el-col>
            <el-col :span="12" :sm="12">
                <div class="neon-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        网络流量趋势
                        <span class="net-inline"><span class="net-rx">↓ {{ rxSpeed }} KB/s</span><span class="net-tx">↑ {{ txSpeed }} KB/s</span></span>
                    </div>
                    <div ref="networkChart" class="chart-area" style="height:180px"></div>
                </div>
            </el-col>
        </el-row>

        <!-- 第四行：Docker容器监控 -->
        <el-row :gutter="10" class="section-row" v-if="dockerAvailable">
            <el-col :span="24">
                <div class="neon-card docker-card">
                    <div class="neon-card-title docker-title">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M13 3h-2v2h2V3zm4 0h-2v2h2V3zm0 4h-2v2h2V7zm-4 0h-2v2h2V7zm-4 0H7v2h2V7zm-4 0H3v2h2V7zm0-4H3v2h2V3zm4 0H7v2h2V3zm12 8.5c-.69-.73-2.18-1-3.32-.8-.48-1.68-1.82-2.5-3.18-2.7v-1h-2v1H9V9H7v1H3v1c0 3.87 3.13 7 7 7h4c2.5 0 4.7-1.3 5.93-3.27.81.15 2.07.07 2.57-1.23z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="docker-title-text">Docker 容器监控</span>
                        <div class="docker-badges">
                            <span class="docker-badge docker-ver" v-if="dockerVersion">v{{ dockerVersion }}</span>
                            <span class="docker-badge docker-running">
                                <span class="docker-dot docker-dot-run"></span>
                                {{ dockerContainersRunning }} 运行
                            </span>
                            <span class="docker-badge docker-stopped">
                                <span class="docker-dot docker-dot-stop"></span>
                                {{ dockerContainersStopped }} 停止
                            </span>
                            <span class="docker-badge docker-images">
                                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M2 12h20M12 2v20"/></svg>
                                {{ dockerImages }} 镜像
                            </span>
                        </div>
                        <el-button size="small" :icon="Refresh" circle class="docker-refresh-btn" @click="loadDockerStats" :loading="dockerLoading" />
                    </div>
                    <div class="docker-container-list" v-if="dockerContainers.length">
                        <div class="docker-table-header">
                            <span class="dc dc-state">状态</span>
                            <span class="dc dc-name">容器名称</span>
                            <span class="dc dc-image">镜像</span>
                            <span class="dc dc-cpu">CPU</span>
                            <span class="dc dc-cpu-bar"></span>
                            <span class="dc dc-mem">内存</span>
                            <span class="dc dc-mem-bar"></span>
                            <span class="dc dc-net">网络 I/O</span>
                            <span class="dc dc-block">磁盘 I/O</span>
                            <span class="dc dc-pids">PIDs</span>
                        </div>
                        <div class="docker-table-body">
                            <div v-for="(c, i) in dockerContainers" :key="i"
                                 class="docker-row" :class="{ 'docker-row-stopped': c.State !== 'running' }">
                                <span class="dc dc-state">
                                    <span class="state-indicator" :class="'state-' + (c.State || 'exited')"></span>
                                    <span class="state-text">{{ c.State || 'exited' }}</span>
                                </span>
                                <span class="dc dc-name" :title="c.Name">
                                    <span class="container-name">{{ c.Name }}</span>
                                    <span class="container-id">{{ c.ContainerId }}</span>
                                </span>
                                <span class="dc dc-image" :title="c.Image">{{ c.Image }}</span>
                                <span class="dc dc-cpu" :class="getCpuClass(c.CPUPercNum)">{{ c.CPUPerc }}</span>
                                <span class="dc dc-cpu-bar">
                                    <div class="micro-bar">
                                        <div class="micro-bar-fill micro-bar-cpu" :style="{ width: Math.min(c.CPUPercNum || 0, 100) + '%' }"></div>
                                    </div>
                                </span>
                                <span class="dc dc-mem">
                                    <span class="mem-usage-text">{{ c.MemUsage }}</span>
                                    <span class="mem-perc" :class="getMemClass(c.MemPercNum)">{{ c.MemPerc }}</span>
                                </span>
                                <span class="dc dc-mem-bar">
                                    <div class="micro-bar">
                                        <div class="micro-bar-fill micro-bar-mem" :style="{ width: Math.min(c.MemPercNum || 0, 100) + '%' }"></div>
                                    </div>
                                </span>
                                <span class="dc dc-net">
                                    <span class="net-detail">{{ c.NetIO }}</span>
                                </span>
                                <span class="dc dc-block">
                                    <span class="block-detail">{{ c.BlockIO }}</span>
                                </span>
                                <span class="dc dc-pids">{{ c.PIDs }}</span>
                            </div>
                        </div>
                    </div>
                    <div v-else class="docker-empty">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(0,212,255,0.2)" stroke-width="1.5">
                            <path d="M13 3h-2v2h2V3zm4 0h-2v2h2V3zm0 4h-2v2h2V7zm-4 0h-2v2h2V7zm-4 0H7v2h2V7zm-4 0H3v2h2V7zm0-4H3v2h2V3zm4 0H7v2h2V3zm12 8.5c-.69-.73-2.18-1-3.32-.8-.48-1.68-1.82-2.5-3.18-2.7v-1h-2v1H9V9H7v1H3v1c0 3.87 3.13 7 7 7h4c2.5 0 4.7-1.3 5.93-3.27.81.15 2.07.07 2.57-1.23z"/>
                        </svg>
                        <span>暂无运行中的容器</span>
                    </div>
                </div>
            </el-col>
        </el-row>

        <!-- 第五行：接口引擎排行(50%) + 表数据量排行(50%) -->
        <el-row :gutter="10" class="section-row">
            <el-col :span="12" :sm="12">
                <div class="neon-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                        接口引擎调用排行 TOP10
                    </div>
                    <div ref="apiRankChart" class="chart-area" style="height:240px"></div>
                </div>
            </el-col>
            <el-col :span="12" :sm="12">
                <div class="neon-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                        表数据量排行 TOP10
                    </div>
                    <div ref="tableRankChart" class="chart-area" style="height:240px"></div>
                </div>
            </el-col>
        </el-row>

        <!-- 第六行：最近登录(50%) + 磁盘分区(25%) + 磁盘IO(25%) -->
        <el-row :gutter="10" class="section-row">
            <el-col :span="12" :sm="12">
                <div class="neon-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        最近登录用户
                    </div>
                    <div class="login-table">
                        <div class="login-row login-header">
                            <span class="lc lc-name">姓名</span>
                            <span class="lc lc-acc">账号</span>
                            <span class="lc lc-ip">IP</span>
                            <span class="lc lc-time">时间</span>
                        </div>
                        <div class="login-row" v-for="(u, i) in recentLogins" :key="i">
                            <span class="lc lc-name">{{ u.Name || '-' }}</span>
                            <span class="lc lc-acc">{{ u.Account }}</span>
                            <span class="lc lc-ip">{{ u.LastLoginIP || '-' }}</span>
                            <span class="lc lc-time">{{ u.LastLoginTime || '-' }}</span>
                        </div>
                        <div v-if="!recentLogins.length" class="empty-tip">暂无数据</div>
                    </div>
                </div>
            </el-col>
            <el-col :span="6" :sm="6" :xs="24">
                <div class="neon-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                        磁盘分区
                    </div>
                    <div class="disk-list">
                        <div v-for="(disk, idx) in disks" :key="idx" class="disk-item">
                            <div class="disk-header">
                                <span class="disk-name">{{ disk.MountPoint || disk.Filesystem }}</span>
                                <span class="disk-size">{{ disk.UsedGB }} / {{ disk.TotalGB }} GB</span>
                            </div>
                            <el-progress :percentage="disk.UsagePercent" :color="getDiskColor(disk.UsagePercent)" :stroke-width="7" :show-text="true" :format="p => p + '%'" />
                        </div>
                        <div v-if="!disks.length" class="empty-tip">暂无磁盘数据</div>
                    </div>
                </div>
            </el-col>
            <el-col :span="6" :sm="6" :xs="24">
                <div class="neon-card">
                    <div class="neon-card-title">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                        磁盘IO
                    </div>
                    <div class="io-list" v-if="diskReadSpeed != null">
                        <div class="io-item"><div class="io-lbl">读取速率</div><div class="io-val io-r">{{ diskReadSpeed }}<small> KB/s</small></div></div>
                        <div class="io-item"><div class="io-lbl">写入速率</div><div class="io-val io-w">{{ diskWriteSpeed }}<small> KB/s</small></div></div>
                    </div>
                    <div v-else class="empty-tip">暂无IO数据</div>
                </div>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import { Refresh } from "@element-plus/icons-vue";
import * as echarts from "echarts";

export default {
    name: "sys_monitor",
    setup() { return { Refresh }; },
    data() {
        return {
            // Clock
            serverTimeMs: 0, serverTickBase: 0,
            localTimeDisplay: "", serverTimeDisplay: "", timeDiffWarn: false,
            tickTimer: null,
            lastUpdateTs: "",
            loading: false,
            autoRefresh: true,
            autoRefreshTimer: null,
            frontendVersion: "4.9.9",
            backendVersion: "",
            productEdition: "",
            editionClass: "open",
            // OS
            osType: "-",
            distroName: "",
            kernelVersion: "",
            machineName: "-",
            isDocker: false,
            processorCount: 0,
            uptime: "-",
            runtimeVersion: "",
            // Runtime
            processId: 0,
            processMemory: 0,
            threadCount: 0,
            gcMemory: 0,
            gen0: 0, gen1: 0, gen2: 0,
            runningTime: "-",
            // CPU/Mem
            cpuUsage: 0,
            memUsage: 0,
            memUsedMB: 0,
            memTotalMB: 0,
            loadAvg1: "", loadAvg5: "", loadAvg15: "",
            // Disk
            diskUsage: 0, diskUsed: 0, diskTotal: 0,
            disks: [],
            diskReadSpeed: null, diskWriteSpeed: null,
            // Network
            rxTotal: 0, txTotal: 0, rxSpeed: 0, txSpeed: 0,
            // 平台统计
            diyTableCount: 0,
            sysMenuCount: 0,
            apiEngineCount: 0,
            osClientCount: 0,
            userCount: 0,
            recentLogins: [],
            apiEngineRank: [],
            tableDataRank: [],
            // 趋势历史
            trendLabels: [],
            cpuHistory: [],
            memHistory: [],
            rxHistory: [],
            txHistory: [],
            // Docker
            dockerAvailable: false,
            dockerLoading: false,
            dockerVersion: "",
            dockerContainersRunning: 0,
            dockerContainersStopped: 0,
            dockerContainersTotal: 0,
            dockerImages: 0,
            dockerContainers: [],
            // Charts (private cache)
            _cpuChart: null, _memChart: null, _diskChart: null,
            _trendChart: null, _networkChart: null,
            _apiRankChart: null, _tableRankChart: null,
            maxTrendPoints: 40
        };
    },
    computed: {
        platformStatCards() {
            return [
                { key: 'table', label: '表单引擎', value: this.diyTableCount, bg: 'linear-gradient(135deg,#667eea,#764ba2)', icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
                { key: 'menu', label: '模块引擎', value: this.sysMenuCount, bg: 'linear-gradient(135deg,#f093fb,#f5576c)', icon: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>' },
                { key: 'api', label: '接口引擎', value: this.apiEngineCount, bg: 'linear-gradient(135deg,#4facfe,#00f2fe)', icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>' },
                { key: 'saas', label: 'SaaS引擎', value: this.osClientCount, bg: 'linear-gradient(135deg,#43e97b,#38f9d7)', icon: '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>' },
                { key: 'user', label: '用户总数', value: this.userCount, bg: 'linear-gradient(135deg,#fa709a,#fee140)', icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>' }
            ];
        }
    },
    mounted() {
        this.loadAll();
        this.loadPlatformStats();
        this.loadDockerStats();
        this.toggleAutoRefresh(true);
        this.startTick();
        window.addEventListener("resize", this.resizeCharts);
    },
    beforeUnmount() {
        if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
        if (this.tickTimer) clearInterval(this.tickTimer);
        window.removeEventListener("resize", this.resizeCharts);
        [this._cpuChart, this._memChart, this._diskChart, this._trendChart, this._networkChart, this._apiRankChart, this._tableRankChart]
            .forEach(c => c && c.dispose());
    },
    methods: {
        // === 时钟 ===
        startTick() {
            this.tickTimer = setInterval(() => {
                var now = Date.now();
                this.localTimeDisplay = this.fmtDT(now);
                if (this.serverTimeMs > 0) {
                    var elapsed = performance.now() - this.serverTickBase;
                    var sNow = this.serverTimeMs + elapsed;
                    this.serverTimeDisplay = this.fmtDT(sNow);
                    this.timeDiffWarn = Math.abs(sNow - now) >= 60000;
                }
            }, 1000);
        },
        fmtDT(ms) {
            var d = new Date(ms);
            var z = function(n) { return String(n).padStart(2, "0"); };
            return d.getFullYear() + "-" + z(d.getMonth()+1) + "-" + z(d.getDate())
                 + " " + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds());
        },
        toggleAutoRefresh(val) {
            if (this.autoRefreshTimer) { clearInterval(this.autoRefreshTimer); this.autoRefreshTimer = null; }
            if (val) { this.autoRefreshTimer = setInterval(() => { this.loadAll(); this.loadDockerStats(); }, 5000); }
        },
        resizeCharts() {
            [this._cpuChart, this._memChart, this._diskChart, this._trendChart, this._networkChart, this._apiRankChart, this._tableRankChart].forEach(c => c && c.resize());
        },
        loadAll() {
            this.loading = true;
            this.DiyCommon.Post("/api/systemmonitor/GetSystemOverview", {}, (result) => {
                this.loading = false;
                if (result && result.Code === 1 && result.Data) {
                    this.parseData(result.Data);
                    this.lastUpdateTs = this.fmtDT(Date.now());
                }
            });
        },
        loadPlatformStats() {
            this.DiyCommon.Post("/api/systemmonitor/GetPlatformStats", {}, (result) => {
                if (result && result.Code === 1 && result.Data) {
                    var d = result.Data;
                    this.diyTableCount = d.DiyTableCount || 0;
                    this.sysMenuCount = d.SysMenuCount || 0;
                    this.apiEngineCount = d.ApiEngineCount || 0;
                    this.osClientCount = d.OsClientCount || 0;
                    this.userCount = d.UserCount || 0;
                    this.recentLogins = d.RecentLogins || [];
                    this.apiEngineRank = d.ApiEngineRank || [];
                    this.tableDataRank = d.TableDataRank || [];
                    this.$nextTick(() => {
                        this.renderApiRankChart();
                        this.renderTableRankChart();
                    });
                }
            });
        },
        loadDockerStats() {
            this.dockerLoading = true;
            this.DiyCommon.Post("/api/systemmonitor/GetDockerStats", {}, (result) => {
                this.dockerLoading = false;
                if (result && result.Code === 1 && result.Data) {
                    var d = result.Data;
                    this.dockerAvailable = d.Available || false;
                    this.dockerVersion = d.DockerVersion || "";
                    this.dockerContainersRunning = d.ContainersRunning || 0;
                    this.dockerContainersStopped = d.ContainersStopped || 0;
                    this.dockerContainersTotal = d.ContainersTotal || 0;
                    this.dockerImages = d.Images || 0;
                    this.dockerContainers = (d.Containers || []).map(function(item) { return JSON.parse(JSON.stringify(item)); });
                }
            });
        },
        getCpuClass(val) {
            if (!val) return '';
            return val >= 80 ? 'perc-danger' : val >= 50 ? 'perc-warn' : 'perc-ok';
        },
        getMemClass(val) {
            if (!val) return '';
            return val >= 90 ? 'perc-danger' : val >= 70 ? 'perc-warn' : 'perc-ok';
        },
        parseData(d) {
            var os = d.OS || {};
            var rt = d.Runtime || {};
            var cm = d.CpuMemory || {};
            var dk = d.Disk || {};
            var nw = d.Network || {};
            var io = d.DiskIO || {};

            if (d.Timestamp) {
                this.serverTimeMs = new Date(d.Timestamp).getTime();
                this.serverTickBase = performance.now();
            }

            this.osType = os.OSType || os.Platform || "-";
            this.distroName = os.DistributionName || "";
            this.kernelVersion = os.KernelVersion || "";
            this.machineName = os.MachineName || "-";
            this.isDocker = os.IsDocker || false;
            this.processorCount = os.ProcessorCount || 0;
            this.uptime = os.Uptime || "-";

            this.runtimeVersion = rt.RuntimeVersion || "";
            this.backendVersion = rt.BackendVersion || "";
            var edition = rt.ProductEdition || "开源版";
            this.productEdition = edition;
            this.editionClass = edition.indexOf('企业') >= 0 ? 'enterprise' : (edition.indexOf('个人') >= 0 ? 'personal' : 'open');
            this.processId = rt.ProcessId || 0;
            this.processMemory = rt.ProcessMemoryMB || 0;
            this.threadCount = rt.ThreadCount || 0;
            this.gcMemory = rt.GCMemoryMB || 0;
            this.gen0 = rt.Gen0Collections || 0;
            this.gen1 = rt.Gen1Collections || 0;
            this.gen2 = rt.Gen2Collections || 0;
            this.runningTime = rt.RunningTime || "-";

            this.cpuUsage = cm.CpuUsagePercent || 0;
            this.memUsage = cm.MemoryUsagePercent || 0;
            this.memUsedMB = Math.round(cm.MemoryUsedMB || 0);
            this.memTotalMB = Math.round(cm.MemoryTotalMB || 0);
            this.loadAvg1 = cm.LoadAvg1 || "";
            this.loadAvg5 = cm.LoadAvg5 || "";
            this.loadAvg15 = cm.LoadAvg15 || "";

            this.disks = (dk.Disks || []).map(function(item) { return JSON.parse(JSON.stringify(item)); });
            if (this.disks.length > 0) {
                var main = this.disks.find(function(d) { return d.MountPoint === '/' || d.MountPoint === '/overlay'; }) || this.disks[0];
                this.diskUsage = main.UsagePercent || 0;
                this.diskUsed = main.UsedGB || 0;
                this.diskTotal = main.TotalGB || 0;
            }

            this.rxTotal = nw.RxMBTotal || 0;
            this.txTotal = nw.TxMBTotal || 0;
            this.rxSpeed = nw.RxSpeedKBps || 0;
            this.txSpeed = nw.TxSpeedKBps || 0;

            this.diskReadSpeed = io.ReadSpeedKBps != null ? io.ReadSpeedKBps : null;
            this.diskWriteSpeed = io.WriteSpeedKBps != null ? io.WriteSpeedKBps : null;

            var now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
            this.trendLabels.push(now);
            this.cpuHistory.push(this.cpuUsage);
            this.memHistory.push(this.memUsage);
            this.rxHistory.push(this.rxSpeed);
            this.txHistory.push(this.txSpeed);
            if (this.trendLabels.length > this.maxTrendPoints) {
                this.trendLabels.shift(); this.cpuHistory.shift(); this.memHistory.shift(); this.rxHistory.shift(); this.txHistory.shift();
            }

            this.$nextTick(() => {
                this.renderGauges();
                this.updateTrendChart();
                this.updateNetworkChart();
            });
        },

        renderGauges() {
            this.renderGauge(this.$refs.cpuChart,  "_cpuChart",  this.cpuUsage,  "#00d4ff", "rgba(0,212,255,0.1)");
            this.renderGauge(this.$refs.memChart,  "_memChart",  this.memUsage,  "#00ff88", "rgba(0,255,136,0.1)");
            this.renderGauge(this.$refs.diskChart, "_diskChart", this.diskUsage, "#ffaa00", "rgba(255,170,0,0.1)");
        },
        renderGauge(el, key, value, color, bg) {
            if (!el) return;
            if (!this[key]) {
                this[key] = echarts.init(el, null, { renderer: "svg" });
                this[key].setOption({
                    series: [{
                        type: "gauge",
                        startAngle: 220, endAngle: -40,
                        radius: "85%", center: ["50%", "58%"],
                        min: 0, max: 100,
                        progress: { show: true, width: 9, roundCap: true, itemStyle: { color } },
                        axisLine: { lineStyle: { width: 9, color: [[1, bg]] } },
                        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                        pointer: { show: false }, title: { show: false },
                        detail: { show: true, fontSize: 17, fontWeight: "bold", color, offsetCenter: [0, "12%"], formatter: "{value}%" },
                        data: [{ value }]
                    }]
                });
            } else {
                this[key].setOption({ series: [{ data: [{ value }] }] });
            }
        },

        updateTrendChart() {
            var el = this.$refs.trendChart;
            if (!el) return;
            if (!this._trendChart) {
                this._trendChart = echarts.init(el, null, { renderer: "svg" });
                this._trendChart.setOption({
                    animation: false,
                    tooltip: { trigger: "axis", backgroundColor: "rgba(10,20,40,0.9)", borderColor: "#00d4ff22", textStyle: { color: "#c9d1d9", fontSize: 11 } },
                    legend: { data: ["CPU%", "内存%"], textStyle: { color: "#d5d5d5", fontSize: 11 }, top: 0, right: 8 },
                    grid: { left: 36, right: 10, top: 28, bottom: 20 },
                    xAxis: { type: "category", data: this.trendLabels, axisLabel: { color: "#d3d3d3", fontSize: 10 }, axisLine: { lineStyle: { color: "#161b22" } }, splitLine: { show: false } },
                    yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: "#d3d3d3", formatter: "{value}%" }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#0d1117" } } },
                    series: [
                        { name: "CPU%", type: "line", data: this.cpuHistory, smooth: true, symbol: "none", lineStyle: { width: 1.5, color: "#00d4ff" }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:"rgba(0,212,255,0.2)"},{offset:1,color:"rgba(0,212,255,0)"}]) } },
                        { name: "内存%", type: "line", data: this.memHistory, smooth: true, symbol: "none", lineStyle: { width: 1.5, color: "#00ff88" }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:"rgba(0,255,136,0.2)"},{offset:1,color:"rgba(0,255,136,0)"}]) } }
                    ]
                });
            } else {
                this._trendChart.setOption({ xAxis: { data: this.trendLabels }, series: [{ data: this.cpuHistory }, { data: this.memHistory }] });
            }
        },

        updateNetworkChart() {
            var el = this.$refs.networkChart;
            if (!el) return;
            if (!this._networkChart) {
                this._networkChart = echarts.init(el, null, { renderer: "svg" });
                this._networkChart.setOption({
                    animation: false,
                    tooltip: { trigger: "axis", backgroundColor: "rgba(10,20,40,0.9)", borderColor: "#00d4ff22", textStyle: { color: "#c9d1d9", fontSize: 11 } },
                    legend: { data: ["入站KB/s", "出站KB/s"], textStyle: { color: "#d5d5d5", fontSize: 11 }, top: 0, right: 8 },
                    grid: { left: 42, right: 10, top: 28, bottom: 20 },
                    xAxis: { type: "category", data: this.trendLabels, axisLabel: { color: "#d3d3d3", fontSize: 10 }, axisLine: { lineStyle: { color: "#161b22" } }, splitLine: { show: false } },
                    yAxis: { type: "value", min: 0, axisLabel: { color: "#d3d3d3" }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#0d1117" } } },
                    series: [
                        { name: "入站KB/s", type: "line", data: this.rxHistory, smooth: true, symbol: "none", lineStyle: { width: 1.5, color: "#36d399" }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:"rgba(54,211,153,0.18)"},{offset:1,color:"rgba(54,211,153,0)"}]) } },
                        { name: "出站KB/s", type: "line", data: this.txHistory, smooth: true, symbol: "none", lineStyle: { width: 1.5, color: "#f7768e" }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:"rgba(247,118,142,0.18)"},{offset:1,color:"rgba(247,118,142,0)"}]) } }
                    ]
                });
            } else {
                this._networkChart.setOption({ xAxis: { data: this.trendLabels }, series: [{ data: this.rxHistory }, { data: this.txHistory }] });
            }
        },

        renderApiRankChart() {
            var el = this.$refs.apiRankChart;
            if (!el) return;
            if (!this._apiRankChart) this._apiRankChart = echarts.init(el, null, { renderer: "svg" });
            var names = this.apiEngineRank.map(function(r) { return (r.Name + '(' + r.ApiEngineKey + ')') || ""; }).reverse();
            var vals  = this.apiEngineRank.map(function(r) { return r.RequestCount || 0; }).reverse();
            this._apiRankChart.setOption({
                animation: false,
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "rgba(10,20,40,0.9)", borderColor: "#00d4ff22", textStyle: { color: "#c9d1d9", fontSize: 11 } },
                grid: { left: 100, right: 26, top: 8, bottom: 8 },
                xAxis: { type: "value", axisLabel: { color: "#d3d3d3", fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#0d1117" } } },
                yAxis: { type: "category", data: names, axisLabel: { color: "#fff", fontSize: 11, width: 88, overflow: "truncate" }, axisLine: { show: false }, axisTick: { show: false } },
                series: [{ type: "bar", data: vals, barWidth: 12, itemStyle: { borderRadius: [0,4,4,0], color: new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:"#4facfe"},{offset:1,color:"#00f2fe"}]) }, label: { show: true, position: "right", color: "#d5d5d5", fontSize: 10 } }]
            });
        },

        renderTableRankChart() {
            var el = this.$refs.tableRankChart;
            if (!el) return;
            if (!this._tableRankChart) this._tableRankChart = echarts.init(el, null, { renderer: "svg" });
            var names = this.tableDataRank.map(function(r) { return r.Label || r.Name || ""; }).reverse();
            var vals  = this.tableDataRank.map(function(r) { return r.DataCount || 0; }).reverse();
            this._tableRankChart.setOption({
                animation: false,
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "rgba(10,20,40,0.9)", borderColor: "#00d4ff22", textStyle: { color: "#c9d1d9", fontSize: 11 } },
                grid: { left: 100, right: 26, top: 8, bottom: 8 },
                xAxis: { type: "value", axisLabel: { color: "#d3d3d3", fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#0d1117" } } },
                yAxis: { type: "category", data: names, axisLabel: { color: "#fff", fontSize: 11, width: 88, overflow: "truncate" }, axisLine: { show: false }, axisTick: { show: false } },
                series: [{ type: "bar", data: vals, barWidth: 12, itemStyle: { borderRadius: [0,4,4,0], color: new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:"#f093fb"},{offset:1,color:"#f5576c"}]) }, label: { show: true, position: "right", color: "#d5d5d5", fontSize: 10 } }]
            });
        },

        getDiskColor(percent) {
            return percent >= 90 ? "#f56c6c" : percent >= 70 ? "#e6a23c" : "#67c23a";
        }
    }
};
</script>


<style scoped>
.sys-monitor {
    padding: 12px;
    background: #0a0e1a;
    min-height: calc(100vh - 60px);
    color: #c9d1d9;
    font-size: 13px;
}
.section-row { margin-bottom: 10px !important; }

/* ===== 顶部 Banner ===== */
.monitor-header {
    margin-bottom: 12px;
    background: linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(0,112,243,0.08) 50%, rgba(0,255,136,0.04) 100%);
    border: 1px solid rgba(0,212,255,0.15);
    border-radius: 10px;
    overflow: hidden;
    position: relative;
}
.monitor-header::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00d4ff, #00ff88, #ffaa00, transparent);
}
.banner-left, .banner-right { display: flex; align-items: center; gap: 10px; }
.header-banner {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 18px;
}
.banner-icon {
    width: 40px; height: 40px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #00d4ff, #0070f3);
    border-radius: 10px; color: #fff;
    box-shadow: 0 0 16px rgba(0,212,255,0.25);
}
.banner-text { display: flex; flex-direction: column; gap: 1px; }
.banner-title {
    font-size: 18px; font-weight: 800; letter-spacing: 2px;
    background: linear-gradient(90deg, #00d4ff, #00ff88);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.banner-sub {
    font-size: 10px; color: #d3d3d3; letter-spacing: 1.5px;
    font-family: "SF Mono", monospace; text-transform: uppercase;
}
.edition-badge { padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; flex-shrink: 0; }
.edition-open     { background: rgba(0,212,255,0.12); color: #00d4ff; border: 1px solid rgba(0,212,255,0.25); }
.edition-personal { background: rgba(0,255,136,0.12); color: #00ff88; border: 1px solid rgba(0,255,136,0.25); }
.edition-enterprise { background: rgba(255,170,0,0.12); color: #ffaa00; border: 1px solid rgba(255,170,0,0.25); }
.env-tag { font-size: 10px; }

/* 双时钟 */
.clock-box { display: flex; flex-direction: column; gap: 2px; }
.clock-row { display: flex; align-items: center; gap: 5px; line-height: 1.4; }
.clock-lbl { font-size: 10px; color: #999; width: 36px; font-family: "SF Mono", monospace; }
.clock-val { font-size: 12px; font-family: "SF Mono", monospace; color: #fff; letter-spacing: 0.3px; }
.clock-warn { color: #f56c6c !important; }
.banner-sep { width: 1px; height: 28px; background: rgba(0,212,255,0.12); flex-shrink: 0; }

/* 版本上下排列 */
.version-stack { display: flex; flex-direction: column; gap: 1px; }
.ver-line { font-size: 10px; color: #999; font-family: "SF Mono", monospace; white-space: nowrap; }

/* 刷新状态 */
.refresh-info { display: flex; flex-direction: column; gap: 1px; text-align: right; }
.refresh-label { font-size: 10px; color: #d3d3d3; white-space: nowrap; }
.refresh-ts { font-size: 10px; color: #999; font-family: "SF Mono", monospace; white-space: nowrap; }

.refresh-btn {
    background: rgba(0,212,255,0.07) !important;
    border-color: rgba(0,212,255,0.18) !important;
    color: #00d4ff !important;
    width: 32px; height: 32px;
}

/* ===== 通用卡片 ===== */
.neon-card {
    background: rgba(13,17,23,0.92);
    border: 1px solid rgba(0,212,255,0.07);
    border-radius: 8px; padding: 12px; height: 100%;
    box-sizing: border-box;
}
.neon-card-title {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; color: #d5d5d5;
    margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;
}
.neon-card-title svg { color: #00d4ff; opacity: 0.7; flex-shrink: 0; }

/* ===== 仪表盘 ===== */
.gauge-card {
    background: rgba(13,17,23,0.92);
    border: 1px solid rgba(0,212,255,0.07);
    border-radius: 8px; padding: 10px 6px 8px;
    text-align: center; height: 100%;
    box-sizing: border-box;
}
.gauge-chart { width: 100%; height: 90px; }
.gauge-label { font-size: 12px; font-weight: 600; color: #d5d5d5; margin-top: 0; }
.gauge-sub { font-size: 10px; color: #d3d3d3; font-family: "SF Mono", monospace; }

/* ===== 运行时间 ===== */
.uptime-card { display: flex; flex-direction: column; }
.uptime-value { font-size: 16px; font-weight: 700; color: #c9d1d9; margin-bottom: 1px; }
.uptime-sub { font-size: 10px; color: #999; margin-bottom: 8px; }
.info-mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
.mini-item {
    display: flex; justify-content: space-between;
    padding: 2px 5px; background: rgba(0,212,255,0.04); border-radius: 3px;
}
.mini-label { font-size: 10px; color: #d3d3d3; }
.mini-val { font-size: 10px; color: #fff; font-family: "SF Mono", monospace; }

/* ===== 运行环境 ===== */
.env-card .env-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; }
.env-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0; border-bottom: 1px solid rgba(0,212,255,0.04);
}
.env-lbl { font-size: 11px; color: #999; flex-shrink: 0; }
.env-val {
    font-size: 11px; color: #fff; font-family: "SF Mono", monospace;
    max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right;
}

/* ===== 平台统计 ===== */
.stat-cards-wrap {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 8px; height: 100%; padding: 12px;
    background: rgba(13,17,23,0.92);
    border: 1px solid rgba(0,212,255,0.07); border-radius: 8px;
    align-content: center; box-sizing: border-box;
}
.stat-card {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; padding: 10px 4px; gap: 5px;
    background: rgba(0,212,255,0.03); border-radius: 6px;
    border: 1px solid rgba(0,212,255,0.06);
}
.stat-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.stat-num { font-size: 18px; font-weight: 700; color: #e6edf3; font-family: "SF Mono", monospace; line-height: 1; }
.stat-label { font-size: 10px; color: #999; }

/* ===== 网络内联统计 ===== */
.net-inline { margin-left: auto; display: flex; gap: 10px; }
.net-rx { font-size: 11px; font-weight: 600; color: #36d399; font-family: "SF Mono", monospace; }
.net-tx { font-size: 11px; font-weight: 600; color: #f7768e; font-family: "SF Mono", monospace; }

/* ===== 图表 ===== */
.chart-area { width: 100%; }

/* ===== 最近登录 ===== */
.login-table { font-size: 12px; }
.login-row { display: flex; padding: 5px 0; border-bottom: 1px solid rgba(0,212,255,0.04); align-items: center; }
.login-row:last-child { border-bottom: none; }
.login-header { font-weight: 600; color: #d3d3d3; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
.lc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-name { flex: 0 0 64px; color: #c9d1d9; }
.lc-acc  { flex: 0 0 84px; color: #fff; font-family: "SF Mono", monospace; }
.lc-ip   { flex: 0 0 104px; color: #d5d5d5; font-family: "SF Mono", monospace; font-size: 11px; }
.lc-time { flex: 1; color: #999; font-size: 11px; text-align: right; }

/* ===== 磁盘 ===== */
.disk-list { display: flex; flex-direction: column; gap: 10px; }
.disk-header { display: flex; justify-content: space-between; margin-bottom: 3px; }
.disk-name { font-size: 11px; color: #fff; font-family: "SF Mono", monospace; }
.disk-size { font-size: 10px; color: #999; }

/* ===== IO ===== */
.io-list { display: flex; flex-direction: column; gap: 14px; padding-top: 6px; }
.io-item { text-align: center; }
.io-lbl { font-size: 10px; color: #999; margin-bottom: 3px; }
.io-val { font-size: 22px; font-weight: 700; font-family: "SF Mono", monospace; }
.io-val small { font-size: 10px; font-weight: 400; color: #999; }
.io-r { color: #36d399; }
.io-w { color: #f7768e; }

/* ===== Docker 容器监控 ===== */
.docker-card {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(0,150,255,0.12);
    background: linear-gradient(180deg, rgba(13,17,23,0.95) 0%, rgba(10,14,26,0.98) 100%);
}
.docker-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,150,255,0.4), rgba(0,212,255,0.6), rgba(0,150,255,0.4), transparent);
}
.docker-title {
    display: flex; align-items: center; gap: 6px; margin-bottom: 12px;
    padding-bottom: 10px; border-bottom: 1px solid rgba(0,212,255,0.06);
}
.docker-title svg { color: #0096ff; }
.docker-title-text {
    font-size: 12px; font-weight: 700; color: #e6edf3; letter-spacing: 1px;
    background: linear-gradient(90deg, #00d4ff, #0096ff);
    background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.docker-badges { display: flex; align-items: center; gap: 8px; margin-left: 10px; }
.docker-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 10px; font-size: 10px;
    font-family: "SF Mono", monospace; letter-spacing: 0.2px;
}
.docker-ver { background: rgba(0,150,255,0.1); color: #5bc0ff; border: 1px solid rgba(0,150,255,0.2); }
.docker-running { background: rgba(0,255,136,0.08); color: #36d399; border: 1px solid rgba(0,255,136,0.15); }
.docker-stopped { background: rgba(255,170,0,0.08); color: #ffaa00; border: 1px solid rgba(255,170,0,0.15); }
.docker-images { background: rgba(160,120,255,0.08); color: #a078ff; border: 1px solid rgba(160,120,255,0.15); }
.docker-images svg { color: #a078ff; }
.docker-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.docker-dot-run { background: #36d399; box-shadow: 0 0 6px rgba(54,211,153,0.6); animation: dotPulse 2s ease infinite; }
.docker-dot-stop { background: #ffaa00; }
@keyframes dotPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.docker-refresh-btn {
    margin-left: auto;
    background: rgba(0,150,255,0.06) !important;
    border-color: rgba(0,150,255,0.15) !important;
    color: #0096ff !important;
    width: 26px; height: 26px;
}

/* Docker Table */
.docker-table-header {
    display: flex; align-items: center; padding: 6px 8px;
    background: rgba(0,150,255,0.04);
    border-radius: 6px; margin-bottom: 4px;
    font-size: 10px; font-weight: 600; color: #8b949e;
    text-transform: uppercase; letter-spacing: 0.5px;
}
.docker-table-body { max-height: 320px; overflow-y: auto; }
.docker-table-body::-webkit-scrollbar { width: 4px; }
.docker-table-body::-webkit-scrollbar-track { background: transparent; }
.docker-table-body::-webkit-scrollbar-thumb { background: rgba(0,150,255,0.15); border-radius: 2px; }
.docker-row {
    display: flex; align-items: center; padding: 7px 8px;
    border-bottom: 1px solid rgba(0,212,255,0.03);
    transition: background 0.15s;
}
.docker-row:hover { background: rgba(0,150,255,0.04); }
.docker-row-stopped { opacity: 0.5; }
.dc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.dc-state { flex: 0 0 72px; display: flex; align-items: center; gap: 5px; }
.dc-name { flex: 0 0 150px; display: flex; flex-direction: column; gap: 0; }
.dc-image { flex: 0 0 160px; color: #8b949e; font-size: 10px; }
.dc-cpu { flex: 0 0 62px; font-family: "SF Mono", monospace; font-weight: 600; text-align: right; }
.dc-cpu-bar { flex: 0 0 70px; padding: 0 6px; }
.dc-mem { flex: 0 0 140px; display: flex; flex-direction: column; gap: 0; font-family: "SF Mono", monospace; }
.dc-mem-bar { flex: 0 0 70px; padding: 0 6px; }
.dc-net { flex: 0 0 130px; font-family: "SF Mono", monospace; font-size: 10px; color: #8b949e; }
.dc-block { flex: 0 0 130px; font-family: "SF Mono", monospace; font-size: 10px; color: #8b949e; }
.dc-pids { flex: 0 0 44px; text-align: center; font-family: "SF Mono", monospace; color: #d5d5d5; }

.state-indicator { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.state-running { background: #36d399; box-shadow: 0 0 6px rgba(54,211,153,0.5); }
.state-exited { background: #f56c6c; }
.state-created { background: #ffaa00; }
.state-paused { background: #e6a23c; }
.state-restarting { background: #4facfe; animation: dotPulse 1s ease infinite; }
.state-text { font-size: 10px; color: #8b949e; }

.container-name { font-size: 12px; font-weight: 600; color: #e6edf3; line-height: 1.3; }
.container-id { font-size: 9px; color: #484f58; font-family: "SF Mono", monospace; }

.mem-usage-text { font-size: 10px; color: #c9d1d9; line-height: 1.3; }
.mem-perc { font-size: 11px; font-weight: 600; }

.perc-ok { color: #36d399; }
.perc-warn { color: #ffaa00; }
.perc-danger { color: #f56c6c; }

/* Mini Progress Bars */
.micro-bar {
    width: 100%; height: 5px;
    background: rgba(255,255,255,0.04);
    border-radius: 3px; overflow: hidden;
}
.micro-bar-fill {
    height: 100%; border-radius: 3px;
    transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
    min-width: 0;
}
.micro-bar-cpu {
    background: linear-gradient(90deg, #00d4ff, #0070f3);
    box-shadow: 0 0 6px rgba(0,150,255,0.3);
}
.micro-bar-mem {
    background: linear-gradient(90deg, #36d399, #00ff88);
    box-shadow: 0 0 6px rgba(54,211,153,0.3);
}

.net-detail, .block-detail { color: #8b949e; }

.docker-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; padding: 28px 0; color: #30363d; font-size: 12px;
}

/* ===== 通用 ===== */
.empty-tip { color: #30363d; text-align: center; padding: 20px 0; font-size: 12px; }

/* ===== Element Plus overrides ===== */
.sys-monitor :deep(.el-progress-bar__outer) { background: rgba(0,212,255,0.06) !important; border-radius: 4px; }
.sys-monitor :deep(.el-progress__text) { color: #fff !important; font-size: 10px !important; }
.sys-monitor :deep(.el-switch__core) { background: #21262d; }
.sys-monitor :deep(.el-switch.is-checked .el-switch__core) { background: #0070f3; }
</style>
