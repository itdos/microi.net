<template>
    <div class="form-amap">
        <div class="map-container" :id="'map_id_' + field.Name" :class="{ 'fullscreen-map': isFullScreen }" ref="mapContainer">
            <!-- 地图渲染容器 -->
            <div ref="mapEl" class="map-view"></div>

            <!-- 控制按钮区域 -->
            <div class="map-controls">
                <!-- MapArea: 开始/停止绘制 -->
                <button
                    v-if="isMapArea && FormMode !== 'View'"
                    type="button"
                    :class="polylineEditing ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'"
                    @click="toggleEditing"
                >
                    {{ polylineEditing ? '停止绘制' : '开始绘制' }}
                </button>
                <!-- MapArea: 清除绘制 -->
                <button
                    v-if="isMapArea && FormMode !== 'View'"
                    type="button"
                    class="btn btn-warning btn-sm"
                    @click="clearPolyline"
                >
                    清除绘制
                </button>
                <!-- 全屏按钮 -->
                <button
                    type="button"
                    class="btn btn-success btn-sm"
                    @click="toggleFullScreen"
                >
                    {{ isFullScreen ? '退出全屏' : '全屏' }}
                </button>
            </div>

            <!-- 搜索框 -->
            <div class="map-search-box" v-if="FormMode !== 'View'">
                <el-autocomplete
                    v-model="searchText"
                    size="small"
                    :fetch-suggestions="querySearch"
                    placeholder="搜索地址"
                    :trigger-on-focus="false"
                    @select="handleSearchSelect"
                    style="width: 260px"
                />
            </div>
        </div>

        <!-- 配置弹窗 - 设计模式下可用 -->
        <el-dialog
            v-if="configDialogVisible"
            v-model="configDialogVisible"
            title="地图配置"
            width="500px"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
            draggable
            align-center
        >
            <el-form label-width="100px" label-position="top" size="small">
                <el-form-item label="地图公司">
                    <el-radio-group v-model="configForm.MapCompany">
                        <el-radio value="Baidu">百度地图</el-radio>
                        <el-radio value="AMap">高德地图</el-radio>
                    </el-radio-group>
                    <div class="form-item-tip">选择使用的地图服务提供商</div>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from "vue";
import AMapLoader from "@amap/amap-jsapi-loader";
import { useDiyStore } from "@/pinia";

defineOptions({
    inheritAttrs: false
});

const props = defineProps({
    modelValue: {},
    field: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ""
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(["update:modelValue"]);

const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;
const diyStore = useDiyStore();
const SysConfig = computed(() => diyStore.SysConfig || {});

// ==================== 响应式状态 ====================
const mapContainer = ref(null);
const mapEl = ref(null);
const searchText = ref("");
const isFullScreen = ref(false);
const polylineEditing = ref(false);
const configDialogVisible = ref(false);
const configForm = ref({ MapCompany: "Baidu" });

// ==================== 运行时变量（非响应式） ====================
let mapInstance = null;       // 百度/高德地图实例
let BMapGL = null;            // 百度地图API对象
let AMapInstance = null;      // 高德地图API对象
let currentMarker = null;     // 当前标记点
let currentLabel = null;      // 当前标签
let polylineOverlays = [];    // 多边形/折线覆盖物
let polylinePaths = [];       // 绘制路径数据 [[{lng,lat},...],...]
let tempPolyline = null;      // 临时绘制线(鼠标跟随)
let currentDrawingPath = [];  // 当前正在绘制的路径点
let amapGeocoder = null;      // 高德逆地理编码器
let amapPlaceSearch = null;   // 高德地点搜索
let isDestroyed = false;      // 组件是否已销毁（防止异步回调操作已销毁的实例）

// 百度地图事件处理函数引用（用于精准移除事件监听）
let _bindedBaiduClick = null;
let _bindedBaiduMouseMove = null;
let _bindedBaiduRightClick = null;
let _bindedBaiduZoomEnd = null;

// 默认中心点
const DEFAULT_CENTER = { lng: 121.547481, lat: 29.809263 };
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 15;

// ==================== 计算属性 ====================
const isMapArea = computed(() => props.field.Component === "MapArea");
const mapCompany = computed(() => props.field.Config?.MapCompany || "Baidu");
const isBaidu = computed(() => mapCompany.value === "Baidu" || DiyCommon.IsNull(mapCompany.value));
const isAMap = computed(() => mapCompany.value === "AMap");

// ==================== 配置弹窗 ====================
const openConfig = () => {
    if (!props.field.Config) props.field.Config = {};
    configForm.value = { MapCompany: props.field.Config.MapCompany || "Baidu" };
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config) props.field.Config = {};
    props.field.Config.MapCompany = configForm.value.MapCompany;
    configDialogVisible.value = false;
    DiyCommon.Tips("配置已保存", true);
    destroyMap();
    nextTick(() => initMap());
};

defineExpose({ openConfig });

// ==================== 生命周期 ====================
onMounted(() => {
    isDestroyed = false;
    initMap();
});

onBeforeUnmount(() => {
    isDestroyed = true;
    destroyMap();
});

// ==================== 初始化地图 ====================
function initMap() {
    if (isBaidu.value) {
        loadBaiduMap();
    } else if (isAMap.value) {
        loadAMap();
    }
}

// ==================== 销毁地图 ====================
function destroyMap() {
    try {
        // 百度地图：先移除事件监听，再清除覆盖物
        if (mapInstance && isBaidu.value) {
            if (_bindedBaiduClick) mapInstance.removeEventListener("click", _bindedBaiduClick);
            if (_bindedBaiduMouseMove) mapInstance.removeEventListener("mousemove", _bindedBaiduMouseMove);
            if (_bindedBaiduRightClick) mapInstance.removeEventListener("rightclick", _bindedBaiduRightClick);
            if (_bindedBaiduZoomEnd) mapInstance.removeEventListener("zoomend", _bindedBaiduZoomEnd);
            mapInstance.clearOverlays();
            mapInstance = null;
            BMapGL = null;
        }
        // 高德地图：先移除覆盖物，再 destroy
        if (mapInstance && isAMap.value) {
            if (currentMarker) { mapInstance.remove(currentMarker); }
            if (currentLabel) { mapInstance.remove(currentLabel); }
            polylineOverlays.forEach(ol => mapInstance.remove(ol));
            if (tempPolyline) { mapInstance.remove(tempPolyline); }
            mapInstance.destroy();
            mapInstance = null;
            AMapInstance = null;
            amapGeocoder = null;
            amapPlaceSearch = null;
        }
    } catch (e) {
        // ignore
    }
    currentMarker = null;
    currentLabel = null;
    polylineOverlays = [];
    polylinePaths = [];
    tempPolyline = null;
    currentDrawingPath = [];
    _bindedBaiduClick = null;
    _bindedBaiduMouseMove = null;
    _bindedBaiduRightClick = null;
    _bindedBaiduZoomEnd = null;
    // 清理字段配置
    if (props.field.BaiduMapConfig) {
        props.field.BaiduMapConfig = null;
    }
    if (props.field.AmapConfig) {
        props.field.AmapConfig = null;
    }
}

// ====================================================================
//                         百度地图
// ====================================================================

// 百度地图 JS API 加载（全局单例）
let baiduMapLoadPromise = null;
function loadBaiduMapScript(ak) {
    if (window.BMapGL) return Promise.resolve(window.BMapGL);
    if (baiduMapLoadPromise) return baiduMapLoadPromise;
    baiduMapLoadPromise = new Promise((resolve, reject) => {
        const cbName = "initBMapGL_" + Date.now();
        window[cbName] = () => {
            delete window[cbName];
            resolve(window.BMapGL);
        };
        const script = document.createElement("script");
        script.src = `https://api.map.baidu.com/api?v=3.0&type=webgl&ak=${encodeURIComponent(ak)}&callback=${cbName}`;
        script.onerror = () => {
            baiduMapLoadPromise = null;
            reject(new Error("百度地图JS API加载失败"));
        };
        document.head.appendChild(script);
    });
    return baiduMapLoadPromise;
}

async function loadBaiduMap() {
    const ak = SysConfig.value.BaiduAK;
    if (!ak) {
        console.warn("百度地图：未配置 BaiduAK，请在系统配置中设置");
        return;
    }
    try {
        BMapGL = await loadBaiduMapScript(ak);
    } catch (e) {
        console.error("百度地图加载失败:", e);
        return;
    }
    if (isDestroyed) return; // 异步加载完成后组件可能已销毁
    await nextTick();
    if (!mapEl.value || isDestroyed) return;

    const center = getInitCenter();
    const zoom = getInitZoom();

    mapInstance = new BMapGL.Map(mapEl.value, { enableMapClick: false });
    mapInstance.centerAndZoom(new BMapGL.Point(center.lng, center.lat), zoom);
    mapInstance.enableScrollWheelZoom(false);
    mapInstance.addControl(new BMapGL.NavigationControl({ anchor: window.BMAP_ANCHOR_TOP_RIGHT }));
    mapInstance.addControl(new BMapGL.GeolocationControl({ anchor: window.BMAP_ANCHOR_BOTTOM_RIGHT }));

    // 保存引用到 field（兼容 diy-form.vue cleanup）
    props.field.BaiduMapConfig = {
        _BMap: BMapGL,
        _map: mapInstance,
        ScrollWheelZoom: false,
        Zoom: zoom,
        Center: center
    };

    // 绑定事件（保存引用以便销毁时精准移除）
    _bindedBaiduClick = onBaiduMapClick;
    _bindedBaiduZoomEnd = onBaiduMapZoomEnd;
    mapInstance.addEventListener("click", _bindedBaiduClick);
    mapInstance.addEventListener("zoomend", _bindedBaiduZoomEnd);
    if (isMapArea.value) {
        _bindedBaiduMouseMove = onBaiduMapMouseMove;
        _bindedBaiduRightClick = onBaiduMapRightClick;
        mapInstance.addEventListener("mousemove", _bindedBaiduMouseMove);
        mapInstance.addEventListener("rightclick", _bindedBaiduRightClick);
    }

    // 恢复已有数据
    restoreBaiduData();
}

// 获取初始中心点
function getInitCenter() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (!isMapArea.value && !DiyCommon.IsNull(model[name + "_Lng"])) {
        return { lng: model[name + "_Lng"] || DEFAULT_CENTER.lng, lat: model[name + "_Lat"] || DEFAULT_CENTER.lat };
    }
    if (!DiyCommon.IsNull(model[name]) && !DiyCommon.IsNull(model[name].Center)) {
        return model[name].Center;
    }
    return { ...DEFAULT_CENTER };
}

function getInitZoom() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (!DiyCommon.IsNull(model[name]) && !DiyCommon.IsNull(model[name].Zoom)) {
        return model[name].Zoom;
    }
    if (!isMapArea.value && !DiyCommon.IsNull(model[name + "_Lng"])) {
        return SELECTED_ZOOM;
    }
    return DEFAULT_ZOOM;
}

// 恢复百度地图已有数据
function restoreBaiduData() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;

    if (isMapArea.value) {
        if (!DiyCommon.IsNull(model[name]) && !DiyCommon.IsNull(model[name].Paths)) {
            polylinePaths = model[name].Paths;
            redrawBaiduPolylines();
        }
    } else {
        if (!DiyCommon.IsNull(model[name + "_Lng"])) {
            const point = new BMapGL.Point(model[name + "_Lng"], model[name + "_Lat"]);
            setBaiduMarker(point, getMarkerLabel());
            mapInstance.centerAndZoom(point, SELECTED_ZOOM);
        }
    }
}

function getMarkerLabel() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (!DiyCommon.IsNull(model[name]) && !DiyCommon.IsNull(model[name].Address)) {
        return model[name].Address;
    }
    return "您选择了这里";
}

// ---- 百度地图事件 ----
function onBaiduMapClick(e) {
    if (isDestroyed || !mapInstance) return;
    if (isMapArea.value) {
        if (!polylineEditing.value) return;
        if (currentDrawingPath.length === 0) {
            polylinePaths.push([]);
        }
        const lastPath = polylinePaths[polylinePaths.length - 1];
        lastPath.push({ lng: e.latlng.lng, lat: e.latlng.lat });
        currentDrawingPath = lastPath;
        redrawBaiduPolylines();
    } else {
        if (props.FormMode === "View") return;
        const point = new BMapGL.Point(e.latlng.lng, e.latlng.lat);
        setBaiduMarkerAndGeocode(point);
    }
}

function onBaiduMapMouseMove(e) {
    if (isDestroyed || !mapInstance) return;
    if (!polylineEditing.value) return;
    if (polylinePaths.length === 0) return;
    const lastPath = polylinePaths[polylinePaths.length - 1];
    if (lastPath.length === 0) return;

    const points = lastPath.map(p => new BMapGL.Point(p.lng, p.lat));
    points.push(new BMapGL.Point(e.latlng.lng, e.latlng.lat));
    if (tempPolyline) {
        mapInstance.removeOverlay(tempPolyline);
    }
    tempPolyline = new BMapGL.Polyline(points, { strokeColor: "blue", strokeWeight: 2, strokeOpacity: 0.5, strokeStyle: "dashed" });
    mapInstance.addOverlay(tempPolyline);
}

function onBaiduMapRightClick(e) {
    if (isDestroyed || !mapInstance) return;
    if (!polylineEditing.value) return;
    if (polylinePaths.length === 0) return;
    const lastPath = polylinePaths[polylinePaths.length - 1];
    if (lastPath.length > 0) {
        currentDrawingPath = [];
    }
    if (tempPolyline) {
        mapInstance.removeOverlay(tempPolyline);
        tempPolyline = null;
    }
    updateMapAreaValue();
    redrawBaiduPolylines();
}

function onBaiduMapZoomEnd() {
    if (isDestroyed || !mapInstance) return;
    const center = mapInstance.getCenter();
    const zoom = mapInstance.getZoom();
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (!DiyCommon.IsNull(model[name])) {
        model[name].Zoom = zoom;
        model[name].Center = { lng: center.lng, lat: center.lat };
    }
}

// 设置百度地图标记点
function setBaiduMarker(point, labelText) {
    if (!mapInstance || !BMapGL) return;
    if (currentMarker) mapInstance.removeOverlay(currentMarker);
    if (currentLabel) mapInstance.removeOverlay(currentLabel);

    currentMarker = new BMapGL.Marker(point, { enableDragging: props.FormMode !== "View" });
    mapInstance.addOverlay(currentMarker);

    currentLabel = new BMapGL.Label(labelText || "您选择了这里", {
        offset: new BMapGL.Size(-35, 30),
        position: point
    });
    currentLabel.setStyle({ border: "1px solid #ccc", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", background: "#fff" });
    mapInstance.addOverlay(currentLabel);

    if (props.FormMode !== "View") {
        currentMarker.addEventListener("dragend", (ev) => {
            if (isDestroyed) return;
            const p = ev.point;
            updateMapPointValue(p.lng, p.lat);
            setBaiduMarkerAndGeocode(new BMapGL.Point(p.lng, p.lat));
        });
    }
}

// 设置标记并通过逆地理编码获取地址
function setBaiduMarkerAndGeocode(point) {
    if (isDestroyed) return;
    updateMapPointValue(point.lng, point.lat);
    setBaiduMarker(point, "您选择了这里");
    mapInstance.panTo(point);

    const geocoder = new BMapGL.Geocoder();
    geocoder.getLocation(point, (result) => {
        if (isDestroyed) return;
        if (result) {
            const address = result.address || "";
            if (currentLabel) currentLabel.setContent(address || "您选择了这里");
            const model = props.FormDiyTableModel;
            const name = props.field.Name;
            if (!DiyCommon.IsNull(model[name])) {
                model[name].Address = address;
            } else {
                model[name] = { Address: address };
                emit("update:modelValue", model[name]);
            }
        }
    });
}

// 更新 Map 类型的值（经纬度）
function updateMapPointValue(lng, lat) {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    model[name + "_Lng"] = lng || 0;
    model[name + "_Lat"] = lat || 0;
    if (DiyCommon.IsNull(model[name])) {
        model[name] = {};
    }
    emit("update:modelValue", model[name]);
}

// 更新 MapArea 类型的值
function updateMapAreaValue() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (DiyCommon.IsNull(model[name])) {
        model[name] = {};
    }
    model[name].Paths = polylinePaths;
    emit("update:modelValue", model[name]);
}

// 重绘百度地图多边形
function redrawBaiduPolylines() {
    if (!mapInstance || !BMapGL) return;
    polylineOverlays.forEach(ol => mapInstance.removeOverlay(ol));
    polylineOverlays = [];
    if (tempPolyline) {
        mapInstance.removeOverlay(tempPolyline);
        tempPolyline = null;
    }

    polylinePaths.forEach(path => {
        if (path.length < 2) return;
        const points = path.map(p => new BMapGL.Point(p.lng, p.lat));
        const polyline = new BMapGL.Polyline(points, { strokeColor: "blue", strokeWeight: 3, strokeOpacity: 0.8 });
        mapInstance.addOverlay(polyline);
        polylineOverlays.push(polyline);
    });
}

// ====================================================================
//                         高德地图
// ====================================================================

async function loadAMap() {
    const key = SysConfig.value.AMapKey;
    const securityJsCode = SysConfig.value.AMapSecret;
    if (!key) {
        console.warn("高德地图：未配置 AMapKey，请在系统配置中设置");
        return;
    }

    window._AMapSecurityConfig = { securityJsCode };

    try {
        AMapInstance = await AMapLoader.load({
            key,
            version: "2.0",
            plugins: [
                "AMap.ToolBar",
                "AMap.Scale",
                "AMap.Geocoder",
                "AMap.PlaceSearch",
                "AMap.AutoComplete",
                "AMap.Geolocation",
                "AMap.MapType",
                "AMap.MouseTool",
                "AMap.PolylineEditor"
            ]
        });
    } catch (e) {
        console.error("高德地图加载失败:", e);
        return;
    }
    if (isDestroyed) return;
    await nextTick();
    if (!mapEl.value || isDestroyed) return;

    const center = getInitCenter();
    const zoom = getInitZoom();

    mapInstance = new AMapInstance.Map(mapEl.value, {
        zoom,
        center: [center.lng, center.lat],
        resizeEnable: true
    });

    mapInstance.addControl(new AMapInstance.ToolBar());
    mapInstance.addControl(new AMapInstance.Scale());

    amapGeocoder = new AMapInstance.Geocoder({ radius: 1000, extensions: "all" });
    amapPlaceSearch = new AMapInstance.PlaceSearch({ pageSize: 10 });

    // 保存引用到 field
    props.field.AmapConfig = {
        SelectMarker: null,
        Zoom: zoom,
        Center: [center.lng, center.lat],
        Lng: 0,
        Lat: 0,
        Address: ""
    };

    // 根据组件类型绑定不同事件
    if (isMapArea.value) {
        mapInstance.on("click", onAMapAreaClick);
        mapInstance.on("mousemove", onAMapAreaMouseMove);
        mapInstance.on("rightclick", onAMapAreaRightClick);
    } else {
        mapInstance.on("click", onAMapClick);
    }
    mapInstance.on("zoomend", onAMapZoomEnd);

    // 恢复已有数据
    restoreAMapData();
}

function restoreAMapData() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;

    if (isMapArea.value) {
        // 恢复区域绘制数据
        if (!DiyCommon.IsNull(model[name]) && !DiyCommon.IsNull(model[name].Paths)) {
            polylinePaths = model[name].Paths;
            redrawAMapPolylines();
        }
    } else {
        // 恢复标记点
        if (!DiyCommon.IsNull(model[name + "_Lng"])) {
            const lng = model[name + "_Lng"] || 0;
            const lat = model[name + "_Lat"] || 0;
            setAMapMarker(lng, lat, "您选择了这里");
            mapInstance.setCenter([lng, lat]);
            mapInstance.setZoom(SELECTED_ZOOM);
            amapReverseGeocode(lng, lat);
        }
    }
}

// ---- 高德地图：Map 点选事件 ----
function onAMapClick(e) {
    if (isDestroyed || !mapInstance) return;
    if (props.FormMode === "View") return;
    const lng = e.lnglat.getLng();
    const lat = e.lnglat.getLat();
    updateMapPointValue(lng, lat);
    setAMapMarker(lng, lat, "您选择了这里");
    amapReverseGeocode(lng, lat);
}

// ---- 高德地图：MapArea 区域绘制事件 ----
function onAMapAreaClick(e) {
    if (isDestroyed || !mapInstance) return;
    if (!polylineEditing.value) return;
    if (currentDrawingPath.length === 0) {
        polylinePaths.push([]);
    }
    const lastPath = polylinePaths[polylinePaths.length - 1];
    lastPath.push({ lng: e.lnglat.getLng(), lat: e.lnglat.getLat() });
    currentDrawingPath = lastPath;
    redrawAMapPolylines();
}

function onAMapAreaMouseMove(e) {
    if (isDestroyed || !mapInstance || !AMapInstance) return;
    if (!polylineEditing.value) return;
    if (polylinePaths.length === 0) return;
    const lastPath = polylinePaths[polylinePaths.length - 1];
    if (lastPath.length === 0) return;

    const pathArr = lastPath.map(p => [p.lng, p.lat]);
    pathArr.push([e.lnglat.getLng(), e.lnglat.getLat()]);
    if (tempPolyline) {
        mapInstance.remove(tempPolyline);
    }
    tempPolyline = new AMapInstance.Polyline({
        path: pathArr,
        strokeColor: "blue",
        strokeWeight: 2,
        strokeOpacity: 0.5,
        strokeStyle: "dashed"
    });
    mapInstance.add(tempPolyline);
}

function onAMapAreaRightClick(e) {
    if (isDestroyed || !mapInstance) return;
    if (!polylineEditing.value) return;
    if (polylinePaths.length === 0) return;
    const lastPath = polylinePaths[polylinePaths.length - 1];
    if (lastPath.length > 0) {
        currentDrawingPath = [];
    }
    if (tempPolyline) {
        mapInstance.remove(tempPolyline);
        tempPolyline = null;
    }
    updateMapAreaValue();
    redrawAMapPolylines();
}

function onAMapZoomEnd() {
    if (isDestroyed || !mapInstance) return;
    const center = mapInstance.getCenter();
    const zoom = mapInstance.getZoom();
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (!DiyCommon.IsNull(model[name])) {
        model[name].Zoom = zoom;
        model[name].Center = { lng: center.lng, lat: center.lat };
    }
}

// 重绘高德地图多边形
function redrawAMapPolylines() {
    if (!mapInstance || !AMapInstance) return;
    polylineOverlays.forEach(ol => mapInstance.remove(ol));
    polylineOverlays = [];
    if (tempPolyline) {
        mapInstance.remove(tempPolyline);
        tempPolyline = null;
    }

    polylinePaths.forEach(path => {
        if (path.length < 2) return;
        const pathArr = path.map(p => [p.lng, p.lat]);
        const polyline = new AMapInstance.Polyline({
            path: pathArr,
            strokeColor: "blue",
            strokeWeight: 3,
            strokeOpacity: 0.8
        });
        mapInstance.add(polyline);
        polylineOverlays.push(polyline);
    });
}

function setAMapMarker(lng, lat, label) {
    if (!mapInstance || !AMapInstance) return;
    if (currentMarker) {
        mapInstance.remove(currentMarker);
        currentMarker = null;
    }
    if (currentLabel) {
        mapInstance.remove(currentLabel);
        currentLabel = null;
    }

    currentMarker = new AMapInstance.Marker({
        position: [lng, lat],
        draggable: props.FormMode !== "View"
    });
    mapInstance.add(currentMarker);

    currentLabel = new AMapInstance.Text({
        text: label || "您选择了这里",
        position: [lng, lat],
        offset: new AMapInstance.Pixel(20, 20),
        style: { border: "1px solid #ccc", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", background: "#fff" }
    });
    mapInstance.add(currentLabel);

    mapInstance.setCenter([lng, lat]);

    if (props.FormMode !== "View") {
        currentMarker.on("dragend", () => {
            if (isDestroyed) return;
            const pos = currentMarker.getPosition();
            updateMapPointValue(pos.getLng(), pos.getLat());
            if (currentLabel) currentLabel.setPosition([pos.getLng(), pos.getLat()]);
            amapReverseGeocode(pos.getLng(), pos.getLat());
        });
    }
}

function amapReverseGeocode(lng, lat) {
    if (!amapGeocoder) return;
    amapGeocoder.getAddress([lng, lat], (status, result) => {
        if (isDestroyed) return;
        if (status === "complete" && result.info === "OK") {
            const address = result.regeocode?.formattedAddress || "";
            if (currentLabel) currentLabel.setText(address || "您选择了这里");
            const model = props.FormDiyTableModel;
            const name = props.field.Name;
            if (!DiyCommon.IsNull(model[name])) {
                model[name].Address = address;
            } else {
                model[name] = { Address: address };
                emit("update:modelValue", model[name]);
            }
            if (props.field.AmapConfig) {
                props.field.AmapConfig.Address = address;
            }
        }
    });
}

// ====================================================================
//                         搜索功能（百度/高德通用）
// ====================================================================

function querySearch(queryString, cb) {
    if (DiyCommon.IsNull(queryString)) { cb([]); return; }
    if (isBaidu.value) {
        baiduQuerySearch(queryString, cb);
    } else {
        amapQuerySearch(queryString, cb);
    }
}

function baiduQuerySearch(queryString, cb) {
    if (!BMapGL || !mapInstance) { cb([]); return; }
    const geocoder = new BMapGL.Geocoder();
    geocoder.getPoint(queryString, (point) => {
        if (isDestroyed) return;
        if (point) {
            setBaiduMarkerAndGeocode(point);
            mapInstance.centerAndZoom(point, SELECTED_ZOOM);
        }
    });
    const results = [];
    const local = new BMapGL.LocalSearch(mapInstance, {
        onSearchComplete: (res) => {
            if (isDestroyed) { cb([]); return; }
            if (local.getStatus() === 0 && res) {
                for (let i = 0; i < res.getCurrentNumPois(); i++) {
                    const poi = res.getPoi(i);
                    results.push({
                        value: (poi.address || "") + poi.title,
                        point: poi.point
                    });
                }
            }
            cb(results);
        }
    });
    local.search(queryString);
}

function amapQuerySearch(queryString, cb) {
    if (!amapPlaceSearch) { cb([]); return; }
    amapPlaceSearch.search(queryString, (status, result) => {
        if (isDestroyed) { cb([]); return; }
        if (status === "complete" && result.poiList) {
            const list = result.poiList.pois.map(poi => ({
                value: poi.name + (poi.address ? " - " + poi.address : ""),
                location: poi.location
            }));
            cb(list);
        } else {
            cb([]);
        }
    });
}

function handleSearchSelect(item) {
    if (isBaidu.value) {
        if (item.point) {
            const point = new BMapGL.Point(item.point.lng, item.point.lat);
            setBaiduMarkerAndGeocode(point);
            mapInstance.centerAndZoom(point, SELECTED_ZOOM);
        }
    } else {
        if (item.location) {
            const lng = item.location.getLng();
            const lat = item.location.getLat();
            updateMapPointValue(lng, lat);
            setAMapMarker(lng, lat, item.value);
            mapInstance.setCenter([lng, lat]);
            mapInstance.setZoom(SELECTED_ZOOM);
            amapReverseGeocode(lng, lat);
        }
    }
}

// ====================================================================
//                         区域绘制控制（MapArea）
// ====================================================================

function toggleEditing() {
    polylineEditing.value = !polylineEditing.value;
    // 停止绘制时保存数据
    if (!polylineEditing.value) {
        // 结束当前绘制路径
        if (currentDrawingPath.length > 0) {
            currentDrawingPath = [];
        }
        if (tempPolyline && mapInstance) {
            if (isBaidu.value) mapInstance.removeOverlay(tempPolyline);
            else mapInstance.remove(tempPolyline);
            tempPolyline = null;
        }
        updateMapAreaValue();
        if (isBaidu.value) redrawBaiduPolylines();
        else redrawAMapPolylines();
    }
}

function clearPolyline() {
    polylinePaths = [];
    currentDrawingPath = [];
    if (tempPolyline && mapInstance) {
        if (isBaidu.value) mapInstance.removeOverlay(tempPolyline);
        else mapInstance.remove(tempPolyline);
        tempPolyline = null;
    }
    if (isBaidu.value) {
        polylineOverlays.forEach(ol => mapInstance.removeOverlay(ol));
    } else {
        polylineOverlays.forEach(ol => mapInstance.remove(ol));
    }
    polylineOverlays = [];
    updateMapAreaValue();
}

// ====================================================================
//                         全屏
// ====================================================================

function toggleFullScreen() {
    isFullScreen.value = !isFullScreen.value;
    // 百度地图全屏时启用滚轮缩放
    if (mapInstance && isBaidu.value) {
        if (isFullScreen.value) {
            mapInstance.enableScrollWheelZoom(true);
        } else {
            mapInstance.enableScrollWheelZoom(false);
        }
        if (props.field.BaiduMapConfig) {
            props.field.BaiduMapConfig.ScrollWheelZoom = isFullScreen.value;
        }
    }
    // 高德地图全屏后需要 resize
    if (mapInstance && isAMap.value) {
        nextTick(() => {
            if (mapInstance) mapInstance.resize();
        });
    }
}
</script>

<style scoped>
.form-amap {
    width: 100%;
}
.map-container {
    position: relative;
    width: 100%;
    height: 300px;
}
.map-container.fullscreen-map {
    position: fixed;
    width: 100vw !important;
    height: 100vh !important;
    left: 0;
    top: 0;
    z-index: 1010;
}
.map-view {
    width: 100%;
    height: 100%;
}
.map-controls {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 100;
    display: flex;
    gap: 6px;
}
.map-controls .btn {
    cursor: pointer;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    color: #fff;
}
.map-controls .btn-primary { background: #409eff; }
.map-controls .btn-danger { background: #f56c6c; }
.map-controls .btn-warning { background: #e6a23c; }
.map-controls .btn-success { background: #67c23a; }
.map-controls .btn-sm { font-size: 12px; }
.map-search-box {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 100;
}
.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
