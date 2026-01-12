<template>
    <div class="region-map-container">
        <el-card class="box-card">
            <!-- Time search header -->
            <div class="search-header">
                <div class="search-controls">
                    <span class="search-label">时间范围：</span>
                    <div class="search-inputs">
                        <!-- Period Type Selector -->
                        <el-select v-model="periodType" placeholder="选择时间类型" size="small" class="search-select">
                            <el-option value="year" label="年"></el-option>
                            <el-option value="quarter" label="季"></el-option>
                            <el-option value="month" label="月"></el-option>
                        </el-select>

                        <!-- Year Selector (always visible) -->
                        <el-select v-model="selectedYear" placeholder="选择年份" size="small" class="search-select">
                            <el-option v-for="year in availableYears" :key="year" :value="year" :label="`${year}年`"></el-option>
                        </el-select>

                        <!-- Quarter Selector (visible when periodType is quarter) -->
                        <el-select v-if="periodType === 'quarter'" v-model="selectedQuarter" placeholder="选择季度" size="small" class="search-select">
                            <el-option v-for="quarter in [1, 2, 3, 4]" :key="quarter" :value="quarter" :label="`Q${quarter}`"></el-option>
                        </el-select>

                        <!-- Month Selector (visible when periodType is month) -->
                        <el-select v-if="periodType === 'month'" v-model="selectedMonth" placeholder="选择月份" size="small" class="search-select">
                            <el-option v-for="month in 12" :key="month" :value="month" :label="`${month}月`"></el-option>
                        </el-select>

                        <el-button type="primary" size="small" @click="handleSearch"> 搜索 </el-button>
                    </div>
                </div>
            </div>

            <div class="map-container">
                <el-amap vid="regionMap" :zoom="zoom" :center="center" :plugin="plugins" :events="events" class="amap-box">
                    <!-- 点位标记 -->
                    <el-amap-marker v-for="(marker, index) in markers" :key="'marker_' + index" :position="marker.position" :events="marker.events" :icon="marker.icon" :label="marker.label">
                    </el-amap-marker>
                </el-amap>
            </div>
        </el-card>
    </div>
</template>

<script>
import Vue from "vue";
import VueAMap from "vue-amap";

// 确保VueAMap只被初始化一次
if (!Vue.prototype.$_vueAMapInited) {
    Vue.use(VueAMap);
    Vue.prototype.$_vueAMapInited = true;
}

import { mapState } from "vuex";

export default {
    name: "RegionMap",
    computed: {
        ...mapState({
            // OsClient: state => state.DiyStore.OsClient
            SysConfig: (state) => state.DiyStore.SysConfig
        })
    },
    data() {
        return {
            url: "https://jiejie-m.nbweixin.cn/?token=$V8.CurrentToken$#/pages/tools/jiejie/map",
            zoom: 8,
            center: [116.412427, 39.303573], // 默认中心点，将根据区域自动调整
            plugins: [
                {
                    pName: "Scale",
                    events: {
                        init(instance) {
                            console.log(instance);
                        }
                    }
                },
                {
                    pName: "ToolBar",
                    events: {
                        init(instance) {
                            console.log(instance);
                        }
                    }
                }
                // {
                //   pName: 'MapType',
                //   defaultType: 0,
                //   events: {
                //     init(instance) {
                //       console.log(instance);
                //     }
                //   }
                // }
            ],
            events: {
                init: (map) => {
                    this.mapInstance = map;
                    this.initDistrictExplorer();
                }
            },
            mapInstance: null,
            districtExplorer: null,
            districtLabels: [], // 区域标注
            markers: [], // 点标记
            // 时间选择相关数据
            periodType: "month", // 默认按月选择
            currentYear: new Date().getFullYear(),
            availableYears: [], // 将在created中初始化
            selectedYear: new Date().getFullYear(),
            selectedQuarter: 1,
            selectedMonth: new Date().getMonth() + 1 // 当前月份（1-12）
        };
    },
    methods: {
        initDistrictExplorer() {
            // 加载行政区划插件
            if (!this.mapInstance) {
                console.error("地图实例不存在");
                return;
            }

            console.log("AMapUI已加载，开始加载行政区划插件");
            AMapUI.loadUI(["geo/DistrictExplorer"], (DistrictExplorer) => {
                console.log("DistrictExplorer插件加载成功");
                this.districtExplorer = new DistrictExplorer({
                    map: this.mapInstance
                });

                this.loadAllDistricts();
            });
        },
        // 获取区域信息
        async loadAllDistricts() {
            const res = await this.DiyCommon.FormEngine.GetTableData({
                FormEngineKey: "b_area"
            });
            if (res.Code === 1) {
                this.districtLabels = res.Data;
            }
        },

        // 处理搜索按钮点击事件
        handleSearch() {
            const params = {
                periodType: this.periodType,
                year: this.selectedYear
            };

            // 添加特定时间段的参数
            if (this.periodType === "quarter") {
                params.quarter = this.selectedQuarter;
            } else if (this.periodType === "month") {
                params.month = this.selectedMonth;
            }

            // 计算日期范围
            const dateRange = this.calculateDateRange(this.periodType, this.selectedYear, this.selectedQuarter, this.selectedMonth);

            if (dateRange) {
                params.startDate = dateRange.startDate;
                params.endDate = dateRange.endDate;
            }

            // 调用接口获取数据
            this.getMapReportPointOrAreaData(params);
        },

        // 获取地图点位和区域数据
        async getMapReportPointOrAreaData(params = {}) {
            // 如果没有指定时间段，默认使用当前月份
            if (!params.startDate || !params.endDate) {
                const defaultDateRange = this.calculateDateRange("month", this.selectedYear, null, this.selectedMonth);
                params.startDate = defaultDateRange.startDate;
                params.endDate = defaultDateRange.endDate;
                params.periodType = "month";
                params.year = this.selectedYear;
                params.month = this.selectedMonth;
            }

            try {
                // 调用接口获取数据
                const res = await this.DiyCommon.ApiEngine.Run("MapReportPointOrAreaData", params);

                // 清空现有的标记
                this.markers = [];

                if (res.Code === 1 && res.Data) {
                    // 处理点位标记
                    res.Data.forEach((item) => {
                        this.markers.push({
                            position: [Number(item.longitude), Number(item.latitude)],
                            label: item.title,
                            icon: item.icon,
                            events: {
                                click: () => {
                                    this.$message.info(`点击了${item.title}`);
                                }
                            }
                        });
                    });

                    // 如果有标记点，自动调整地图视野
                    if (this.markers.length > 0) {
                        const avgLat = this.markers.reduce((sum, m) => sum + m.position[1], 0) / this.markers.length;
                        const avgLng = this.markers.reduce((sum, m) => sum + m.position[0], 0) / this.markers.length;

                        this.center = [avgLng, avgLat];
                        this.zoom = 10;
                        console.log("markers", this.markers);
                    }
                } else {
                    this.$message.warning("未获取到数据");
                }
            } catch (error) {
                console.error("获取地图数据失败:", error);
                this.$message.error("获取地图数据失败");
            }
        },

        // 计算日期范围
        calculateDateRange(type, year, quarter, month) {
            if (type === "year") {
                return {
                    startDate: `${year}-01-01`,
                    endDate: `${year}-12-31`
                };
            } else if (type === "quarter") {
                const startMonth = (quarter - 1) * 3 + 1;
                const endMonth = quarter * 3;
                const endDay = new Date(year, endMonth, 0).getDate(); // 获取结束月份的最后一天
                return {
                    startDate: `${year}-${String(startMonth).padStart(2, "0")}-01`,
                    endDate: `${year}-${String(endMonth).padStart(2, "0")}-${endDay}`
                };
            } else if (type === "month") {
                const endDay = new Date(year, month, 0).getDate(); // 获取月份的最后一天
                return {
                    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
                    endDate: `${year}-${String(month).padStart(2, "0")}-${endDay}`
                };
            }
            return null;
        }
    },
    beforeDestroy() {
        // 销毁地图实例
        if (this.mapInstance) {
            this.mapInstance = null;
        }
        if (this.districtExplorer) {
            this.districtExplorer.destroy();
            this.districtExplorer = null;
        }
    },
    created() {
        try {
            // 确保SysConfig存在
            const mapKey = this.SysConfig?.AMapKey || "99b272c930081b69507b218d660be3dc";
            const mapSecret = this.SysConfig?.AMapSecret || "0624622804551e8f0209117bb8de8f82";

            // 设置安全配置
            window._AMapSecurityConfig = {
                securityJsCode: mapSecret // 高德Web端安全密钥
            };

            // 加载AMapUI脚本
            const loadAMapUI = () => {
                if (window.AMapUI) {
                    console.log("AMapUI已加载");
                    return;
                }
                const script = document.createElement("script");
                script.type = "text/javascript";
                script.async = true;
                script.src = "https://webapi.amap.com/ui/1.1/main.js?v=1.1.1";
                document.head.appendChild(script);
                console.log("AMapUI加载脚本已插入");
            };

            // 初始化高德地图API加载器
            VueAMap.initAMapApiLoader({
                key: mapKey,
                plugin: [
                    "Scale",
                    "OverView",
                    "ToolBar",
                    "MapType",
                    "Geocoder",
                    "PlaceSearch",
                    "Autocomplete",
                    "AMap.Autocomplete", //输入提示插件
                    "AMap.PlaceSearch", //POI搜索插件
                    "AMap.Scale", //右下角缩略图插件 比例尺
                    "AMap.OverView", //地图鹰眼插件
                    "AMap.ToolBar", //地图工具条
                    "AMap.MapType", //类别切换控件，实现默认图层与卫星图、实施交通图层之间切换的控制
                    "AMap.PolyEditor", //编辑 折线多，边形
                    "AMap.CircleEditor", //圆形编辑器插件
                    "AMap.Geolocation", //定位控件，用来获取和展示用户主机所在的经纬度位置
                    "AMap.DistrictSearch" // 添加行政区划查询插件
                ],
                v: "1.4.4",
                uiVersion: "1.0"
            });

            // 加载AMapUI
            loadAMapUI();

            // 初始化年份选项
            this.availableYears = Array.from({ length: 5 }, (_, i) => this.currentYear - i);
        } catch (error) {
            console.error("高德地图初始化失败:", error);
        }
    },

    mounted() {
        // 地图组件已挂载，可以进行其他操作
        // 确保地图实例创建后再初始化行政区划
        this.$nextTick(() => {
            const checkMapInstance = () => {
                if (this.mapInstance) {
                    // 先设置地图中心点到丽水市
                    this.mapInstance.setCenter([119.922796, 28.451993]);
                    this.mapInstance.setZoom(9);
                    // 然后初始化行政区划
                    setTimeout(() => {
                        this.initDistrictExplorer();
                    }, 500);
                } else {
                    // 如果地图实例还没准备好，等待事件初始化
                    console.log("等待地图实例初始化...");
                    setTimeout(checkMapInstance, 500);
                }
            };
            checkMapInstance();
        });
    }
};
</script>

<style scoped>
.region-map-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 10px;
    box-sizing: border-box;
}

.search-header {
    padding: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid #ebeef5;
}

.search-controls {
    display: flex;
    align-items: center;
}

.search-label {
    font-weight: 500;
    color: #606266;
    margin-right: 15px;
}

.search-inputs {
    display: flex;
    flex: 1;
    align-items: center;
}

.search-select {
    width: 120px;
    margin-right: 10px;
}

.map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.amap-box {
    width: 100%;
    height: 800px;
}

.custom-marker {
    position: relative;
}

.marker-icon {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.marker-label {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    margin-top: 5px;
}
</style>
