<template>
    <div class="form-map">
        <div
            :id="'map_id_' + field.Name"
            ref="mapContainer"
            class="map-container"
            :class="{ 'fullscreen-map': isFullScreen }"
            :data-map-state="mapState"
            :data-map-provider="resolvedProvider || mapCompany"
            :aria-busy="mapState === 'loading'"
            :aria-label="translate('MapRegionLabel', '地图控件')"
            role="region"
        >
            <div ref="mapEl" class="map-view" :class="{ 'is-ready': mapState === 'ready' }"></div>

            <section
                v-if="mapState === 'loading'"
                class="map-status map-status--loading"
                data-testid="microi-map-loading"
                aria-live="polite"
            >
                <span class="map-loader" aria-hidden="true"></span>
                <strong>{{ translate("MapLoading", "地图加载中…") }}</strong>
                <p>{{ providerLabel }} · {{ translate("MapLoadingHint", "正在读取租户安全配置并连接地图服务") }}</p>
            </section>

            <section
                v-else-if="mapState === 'error'"
                class="map-status map-status--error"
                data-testid="microi-map-error"
                aria-live="assertive"
            >
                <span class="map-error-icon" aria-hidden="true">!</span>
                <div class="map-error-copy">
                    <strong>{{ translate("MapLoadFailed", "地图未能加载") }}</strong>
                    <p>{{ mapError.message }}</p>
                    <small v-if="mapError.detail && mapError.detail !== mapError.message">{{ mapError.detail }}</small>
                    <div class="map-error-meta">
                        <span data-testid="microi-map-provider">{{ providerLabel }}</span>
                        <code>{{ mapError.code }}</code>
                    </div>
                    <p class="map-settings-path">
                        {{ translate("MapSettingsPath", "配置位置：系统设置 → 安全与服务接入。浏览器地图 Key 还必须在供应商控制台设置当前域名白名单。") }}
                    </p>
                    <el-button
                        type="primary"
                        size="small"
                        :loading="mapRetrying"
                        data-testid="microi-map-retry"
                        @click="retryMap"
                    >
                        {{ translate("MapRetry", "重新加载") }}
                    </el-button>
                </div>
            </section>

            <template v-if="mapState === 'ready'">
                <div class="map-controls">
                    <el-button
                        v-if="isMapArea && FormMode !== 'View'"
                        :type="polylineEditing ? 'danger' : 'primary'"
                        size="small"
                        @click="toggleEditing"
                    >
                        {{ polylineEditing ? translate("MapStopDrawing", "停止绘制") : translate("MapStartDrawing", "开始绘制") }}
                    </el-button>
                    <el-button
                        v-if="isMapArea && FormMode !== 'View'"
                        type="warning"
                        size="small"
                        @click="clearPolyline"
                    >
                        {{ translate("MapClearDrawing", "清除绘制") }}
                    </el-button>
                    <el-button type="success" size="small" @click="toggleFullScreen">
                        {{ isFullScreen ? translate("MapExitFullscreen", "退出全屏") : translate("MapFullscreen", "全屏") }}
                    </el-button>
                </div>

                <div v-if="FormMode !== 'View'" class="map-search-box">
                    <el-autocomplete
                        v-model="searchText"
                        size="small"
                        :fetch-suggestions="querySearch"
                        :placeholder="translate('MapSearchAddress', '搜索地址')"
                        :trigger-on-focus="false"
                        clearable
                        @select="handleSearchSelect"
                    />
                </div>

                <span class="map-provider-badge" data-testid="microi-map-provider">{{ providerLabel }}</span>
            </template>
        </div>

        <el-dialog
            v-if="configDialogVisible"
            v-model="configDialogVisible"
            class="mci-unified-dialog mci-field-config-dialog"
            :title="translate('MapConfigTitle', '地图配置')"
            width="520px"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
            draggable
            align-center
        >
            <el-form class="mci-component-config-form" label-width="100px" label-position="top" size="small">
                <el-form-item :label="translate('MapProvider', '地图供应商')">
                    <el-radio-group v-model="configForm.MapCompany">
                        <el-radio value="System">{{ translate("MapProviderSystem", "跟随系统设置") }}</el-radio>
                        <el-radio value="AMap">{{ translate("MapProviderAMap", "高德地图") }}</el-radio>
                        <el-radio value="Baidu">{{ translate("MapProviderBaidu", "百度地图") }}</el-radio>
                        <el-radio value="Tencent">{{ translate("MapProviderTencent", "腾讯地图") }}</el-radio>
                    </el-radio-group>
                    <div class="form-item-tip">
                        {{ translate("MapProviderConfigTip", "Key 与安全参数统一在“系统设置 → 安全与服务接入”维护，字段配置不保存任何凭据。") }}
                    </div>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">{{ translate("Cancel", "取消") }}</el-button>
                <el-button type="primary" @click="saveConfig">{{ translate("Confirm", "确定") }}</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import AMapLoader from "@amap/amap-jsapi-loader";
import {
    MAP_PROVIDER,
    MAP_PROVIDER_LABELS,
    MapRuntimeError,
    classifyMapRuntimeError,
    normalizeMapProvider,
    requestMapRuntimeConfig,
    supportsWebGl,
    withMapTimeout
} from "./map-runtime.js";

defineOptions({ inheritAttrs: false });

const props = defineProps({
    modelValue: {},
    field: { type: Object, required: true },
    FormMode: { type: String, default: "" },
    FormDiyTableModel: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["update:modelValue"]);
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;
const i18nTranslate = instance.appContext.config.globalProperties.$t;

const translate = (key, fallback, params = {}) => {
    try {
        const fullKey = `Msg.${key}`;
        const value = i18nTranslate?.(fullKey, params);
        if (value && value !== fullKey) return value;
    } catch {
        // i18n is optional in isolated component previews.
    }
    return Object.entries(params).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        fallback
    );
};

const mapContainer = ref(null);
const mapEl = ref(null);
const searchText = ref("");
const isFullScreen = ref(false);
const polylineEditing = ref(false);
const configDialogVisible = ref(false);
const configForm = ref({ MapCompany: MAP_PROVIDER.SYSTEM });
const mapState = ref("idle");
const mapRetrying = ref(false);
const resolvedProvider = ref("");
const mapError = reactive({ code: "", message: "", detail: "" });

let mapInstance = null;
let BMapGL = null;
let AMapInstance = null;
let TMapInstance = null;
let activeProvider = "";
let currentMarker = null;
let currentLabel = null;
let polylineOverlays = [];
let polylinePaths = [];
let tempPolyline = null;
let currentDrawingPath = [];
let amapGeocoder = null;
let amapPlaceSearch = null;
let tencentGeocoder = null;
let tencentSuggestion = null;
let isDestroyed = false;
let initializationId = 0;
let searchSequence = 0;
let resizeObserver = null;
let resizeFrame = 0;
let renderWaitCleanup = () => {};
let bodyOverflowBeforeFullscreen = "";
let bodyScrollLocked = false;

let _bindedBaiduClick = null;
let _bindedBaiduMouseMove = null;
let _bindedBaiduRightClick = null;
let _bindedBaiduZoomEnd = null;
let _bindedTencentClick = null;
let _bindedTencentMouseMove = null;
let _bindedTencentRightClick = null;
let _bindedTencentZoom = null;

const DEFAULT_CENTER = { lng: 121.547481, lat: 29.809263 };
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 15;
const SDK_TIMEOUT = 15000;
const RENDER_TIMEOUT = 12000;
const LEGACY_FIELD_CREDENTIAL_KEYS = Object.freeze([
    "MapKey", "MapSecret", "AMapKey", "AMapSecret", "AMapSecurityJsCode",
    "BaiduAK", "TencentMapKey", "TencentMapJsKey", "QQMapKey", "SecurityJsCode"
]);

const isMapArea = computed(() => props.field.Component === "MapArea");
const mapCompany = computed(() => normalizeMapProvider(props.field.Config?.MapCompany, MAP_PROVIDER.SYSTEM));
const providerLabel = computed(() => MAP_PROVIDER_LABELS[resolvedProvider.value || mapCompany.value] || translate("MapProviderUnknown", "地图服务"));
const isBaidu = computed(() => activeProvider === MAP_PROVIDER.BAIDU);
const isAMap = computed(() => activeProvider === MAP_PROVIDER.AMAP);
const isTencent = computed(() => activeProvider === MAP_PROVIDER.TENCENT);

const ERROR_MESSAGES = {
    MAP_KEY_MISSING: ["MapErrorKeyMissing", "当前供应商尚未配置客户端 Key。"],
    MAP_KEY_INVALID: ["MapErrorKeyInvalid", "地图 Key 无效或已被禁用，请核对供应商控制台。"],
    MAP_SECURITY_CODE_INVALID: ["MapErrorSecurityCode", "高德安全密钥无效；建议改用 serviceHost 安全代理。"],
    MAP_DOMAIN_NOT_ALLOWED: ["MapErrorDomain", "当前访问域名不在地图 Key 的授权白名单中。"],
    MAP_PRODUCT_NOT_ENABLED: ["MapErrorProduct", "该 Key 未开通当前 JavaScript 地图产品。"],
    MAP_RUNTIME_API_UNAVAILABLE: ["MapErrorRuntimeApi", "后端尚未提供安全地图配置接口，请先升级吾码后端。"],
    MAP_RUNTIME_CONFIG_FAILED: ["MapErrorRuntimeConfig", "租户地图安全配置读取失败，请稍后重试。"],
    MAP_RUNTIME_CONFIG_INVALID: ["MapErrorRuntimeConfigInvalid", "租户地图安全配置无法解密或格式无效，请重新保存。"],
    MAP_AMAP_SERVICE_HOST_INVALID: ["MapErrorServiceHost", "高德地图 serviceHost 安全代理地址格式无效。"],
    MAP_PROVIDER_UNSUPPORTED: ["MapErrorProvider", "当前地图供应商不受支持。"],
    MAP_WEBGL_UNAVAILABLE: ["MapErrorWebGL", "当前浏览器未启用 WebGL，无法渲染地图。"],
    MAP_CONTAINER_HIDDEN: ["MapErrorContainer", "地图容器没有可用尺寸，请展开当前分组或检查表单布局。"],
    MAP_SDK_NETWORK: ["MapErrorNetwork", "地图 SDK 网络请求失败，请检查网络、代理、CSP 或浏览器拦截。"],
    MAP_SDK_TIMEOUT: ["MapErrorTimeout", "地图 SDK 加载超时，请检查网络和供应商服务状态。"],
    MAP_SDK_RENDER_TIMEOUT: ["MapErrorRenderTimeout", "地图底图长时间未完成渲染，通常由 Key、域名白名单、WebGL 或网络错误导致。"],
    MAP_SDK_INIT_FAILED: ["MapErrorInit", "地图 SDK 初始化失败，请检查供应商配置和浏览器控制台。"]
};

function errorMessage(code) {
    const entry = ERROR_MESSAGES[code] || ["MapErrorUnknown", "地图加载失败，请检查配置、网络和浏览器兼容性。"];
    return translate(entry[0], entry[1]);
}

function showMapError(error, provider = "") {
    const classified = classifyMapRuntimeError(error, provider || resolvedProvider.value || mapCompany.value);
    resolvedProvider.value = normalizeMapProvider(classified.provider, resolvedProvider.value || mapCompany.value);
    mapError.code = classified.code || "MAP_SDK_INIT_FAILED";
    mapError.message = errorMessage(mapError.code);
    mapError.detail = classified.detail || "";
    mapState.value = "error";
}

function clearMapError() {
    mapError.code = "";
    mapError.message = "";
    mapError.detail = "";
}

const openConfig = () => {
    if (!props.field.Config) props.field.Config = {};
    configForm.value = { MapCompany: normalizeMapProvider(props.field.Config.MapCompany, MAP_PROVIDER.SYSTEM) };
    configDialogVisible.value = true;
};

const saveConfig = async () => {
    if (!props.field.Config) props.field.Config = {};
    destroyMap({ preserveState: true, invalidate: true });
    props.field.Config.MapCompany = normalizeMapProvider(configForm.value.MapCompany, MAP_PROVIDER.SYSTEM);
    // Historical designers could persist browser-map credentials in diy_field.Config,
    // which is delivered to every form user. Runtime credentials now come only from
    // the authenticated tenant-settings endpoint, so remove known plaintext leftovers.
    LEGACY_FIELD_CREDENTIAL_KEYS.forEach((key) => delete props.field.Config[key]);
    configDialogVisible.value = false;
    DiyCommon.Tips(translate("MapConfigSaved", "地图配置已保存"), true);
    await nextTick();
    initMap();
};

defineExpose({ openConfig, retryMap: () => retryMap() });

onMounted(() => {
    isDestroyed = false;
    document.addEventListener("keydown", onKeydown);
    initMap();
});

onBeforeUnmount(() => {
    isDestroyed = true;
    document.removeEventListener("keydown", onKeydown);
    destroyMap({ preserveState: true, invalidate: true });
    restoreBodyScroll();
});

async function retryMap() {
    if (mapRetrying.value) return;
    mapRetrying.value = true;
    destroyMap({ preserveState: true, invalidate: true });
    await nextTick();
    await initMap();
    mapRetrying.value = false;
}

async function initMap() {
    const requestId = ++initializationId;
    clearMapError();
    resolvedProvider.value = mapCompany.value;
    mapState.value = "loading";

    try {
        if (!supportsWebGl()) {
            throw new MapRuntimeError("MAP_WEBGL_UNAVAILABLE", "WebGL is unavailable.", mapCompany.value);
        }
        const runtime = await requestMapRuntimeConfig(DiyCommon, mapCompany.value);
        if (!isCurrentInitialization(requestId)) return;
        resolvedProvider.value = runtime.Provider;
        await nextTick();
        await waitForContainerSize(requestId);
        if (!isCurrentInitialization(requestId)) return;

        if (runtime.Provider === MAP_PROVIDER.AMAP) await initializeAMap(runtime, requestId);
        else if (runtime.Provider === MAP_PROVIDER.TENCENT) await initializeTencentMap(runtime, requestId);
        else await initializeBaiduMap(runtime, requestId);

        if (!isCurrentInitialization(requestId)) return;
        installResizeObserver();
        mapState.value = "ready";
    } catch (error) {
        if (!isCurrentInitialization(requestId)) return;
        const provider = resolvedProvider.value || mapCompany.value;
        destroyMap({ preserveState: true, invalidate: false });
        showMapError(error, provider);
    }
}

function isCurrentInitialization(requestId) {
    return !isDestroyed && requestId === initializationId;
}

function waitForContainerSize(requestId) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
            if (!isCurrentInitialization(requestId)) return resolve();
            const rect = mapEl.value?.getBoundingClientRect?.();
            if (rect && rect.width >= 40 && rect.height >= 120) return resolve();
            if (Date.now() - started >= 5000) {
                return reject(new MapRuntimeError("MAP_CONTAINER_HIDDEN", "Map container has no visible size.", resolvedProvider.value));
            }
            window.requestAnimationFrame(check);
        };
        check();
    });
}

function sharedSdkPromise(name, factory) {
    const store = window.__MICROI_MAP_SDK_PROMISES__ || (window.__MICROI_MAP_SDK_PROMISES__ = {});
    if (!store[name]) {
        store[name] = Promise.resolve().then(factory).catch((error) => {
            delete store[name];
            throw error;
        });
    }
    return store[name];
}

function loadBaiduMapScript(clientKey) {
    if (window.BMapGL) return Promise.resolve(window.BMapGL);
    return sharedSdkPromise("Baidu", () => withMapTimeout(new Promise((resolve, reject) => {
        const callbackName = `__microiBMapReady_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement("script");
        let timer = 0;
        const cleanup = () => {
            window.clearTimeout(timer);
            script.onerror = null;
        };
        const fail = (code, message) => {
            cleanup();
            delete window[callbackName];
            reject(new MapRuntimeError(code, message, MAP_PROVIDER.BAIDU));
        };
        window[callbackName] = () => {
            cleanup();
            delete window[callbackName];
            if (window.BMapGL) resolve(window.BMapGL);
            else fail("MAP_SDK_INIT_FAILED", "百度地图 SDK 已响应，但 BMapGL 不可用。");
        };
        script.id = "microi-baidu-map-sdk";
        script.async = true;
        script.src = `https://api.map.baidu.com/api?v=3.0&type=webgl&ak=${encodeURIComponent(clientKey)}&callback=${callbackName}`;
        script.onerror = () => fail("MAP_SDK_NETWORK", "百度地图 JS API 脚本加载失败。");
        timer = window.setTimeout(() => fail("MAP_SDK_TIMEOUT", "百度地图 JS API 脚本加载超时。"), SDK_TIMEOUT);
        document.head.appendChild(script);
    }), SDK_TIMEOUT + 1000, "MAP_SDK_TIMEOUT", MAP_PROVIDER.BAIDU));
}

function loadTencentMapScript(clientKey) {
    if (window.TMap?.Map) return Promise.resolve(window.TMap);
    return sharedSdkPromise("Tencent", () => withMapTimeout(new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.id = "microi-tencent-map-sdk";
        script.async = true;
        script.src = `https://map.qq.com/api/gljs?v=1.exp&libraries=service&key=${encodeURIComponent(clientKey)}`;
        script.onload = () => {
            if (window.TMap?.Map) resolve(window.TMap);
            else reject(new MapRuntimeError("MAP_SDK_INIT_FAILED", "腾讯地图 SDK 已响应，但 TMap 不可用。", MAP_PROVIDER.TENCENT));
        };
        script.onerror = () => reject(new MapRuntimeError("MAP_SDK_NETWORK", "腾讯地图 JavaScript API GL 脚本加载失败。", MAP_PROVIDER.TENCENT));
        document.head.appendChild(script);
    }), SDK_TIMEOUT, "MAP_SDK_TIMEOUT", MAP_PROVIDER.TENCENT));
}

async function initializeBaiduMap(runtime, requestId) {
    BMapGL = await loadBaiduMapScript(runtime.ClientKey);
    if (!isCurrentInitialization(requestId)) return;
    activeProvider = MAP_PROVIDER.BAIDU;
    const center = getInitCenter();
    const zoom = getInitZoom();
    mapInstance = new BMapGL.Map(mapEl.value, { enableMapClick: false });
    const renderPromise = waitForMapRender(
        (done) => mapInstance.addEventListener("tilesloaded", done),
        (done) => mapInstance.removeEventListener("tilesloaded", done),
        MAP_PROVIDER.BAIDU
    );
    mapInstance.centerAndZoom(new BMapGL.Point(center.lng, center.lat), zoom);
    mapInstance.enableScrollWheelZoom(false);
    try {
        mapInstance.addControl(new BMapGL.NavigationControl({ anchor: window.BMAP_ANCHOR_TOP_RIGHT }));
        mapInstance.addControl(new BMapGL.GeolocationControl({ anchor: window.BMAP_ANCHOR_BOTTOM_RIGHT }));
    } catch {
        // Optional controls must not prevent the map itself from rendering.
    }
    props.field.BaiduMapConfig = { _BMap: BMapGL, _map: mapInstance, ScrollWheelZoom: false, Zoom: zoom, Center: center };

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
    restoreBaiduData();
    await renderPromise;
}

async function initializeAMap(runtime, requestId) {
    if (runtime.ServiceHost) window._AMapSecurityConfig = { serviceHost: runtime.ServiceHost };
    else if (runtime.SecurityJsCode) window._AMapSecurityConfig = { securityJsCode: runtime.SecurityJsCode };
    else window._AMapSecurityConfig = {};

    AMapInstance = await sharedSdkPromise("AMap", () => withMapTimeout(AMapLoader.load({
        key: runtime.ClientKey,
        version: "2.0",
        plugins: [
            "AMap.ToolBar", "AMap.Scale", "AMap.Geocoder", "AMap.PlaceSearch",
            "AMap.AutoComplete", "AMap.Geolocation", "AMap.MapType"
        ]
    }), SDK_TIMEOUT, "MAP_SDK_TIMEOUT", MAP_PROVIDER.AMAP));
    if (!isCurrentInitialization(requestId)) return;
    activeProvider = MAP_PROVIDER.AMAP;
    const center = getInitCenter();
    const zoom = getInitZoom();
    mapInstance = new AMapInstance.Map(mapEl.value, {
        zoom,
        center: [center.lng, center.lat],
        resizeEnable: true,
        scrollWheel: false
    });
    const renderPromise = waitForMapRender(
        (done) => mapInstance.on("complete", done),
        (done) => mapInstance.off("complete", done),
        MAP_PROVIDER.AMAP
    );
    mapInstance.addControl(new AMapInstance.ToolBar());
    mapInstance.addControl(new AMapInstance.Scale());
    amapGeocoder = new AMapInstance.Geocoder({ radius: 1000, extensions: "all" });
    amapPlaceSearch = new AMapInstance.PlaceSearch({ pageSize: 10 });
    props.field.AmapConfig = { SelectMarker: null, Zoom: zoom, Center: [center.lng, center.lat], Lng: 0, Lat: 0, Address: "" };
    if (isMapArea.value) {
        mapInstance.on("click", onAMapAreaClick);
        mapInstance.on("mousemove", onAMapAreaMouseMove);
        mapInstance.on("rightclick", onAMapAreaRightClick);
    } else {
        mapInstance.on("click", onAMapClick);
    }
    mapInstance.on("zoomend", onAMapZoomEnd);
    restoreAMapData();
    await renderPromise;
}

async function initializeTencentMap(runtime, requestId) {
    TMapInstance = await loadTencentMapScript(runtime.ClientKey);
    if (!isCurrentInitialization(requestId)) return;
    activeProvider = MAP_PROVIDER.TENCENT;
    const center = getInitCenter();
    const zoom = getInitZoom();
    mapInstance = new TMapInstance.Map(mapEl.value, {
        center: new TMapInstance.LatLng(center.lat, center.lng),
        zoom,
        pitch: 0,
        rotation: 0,
        viewMode: "2D"
    });
    const renderPromise = waitForMapRender(
        (done) => mapInstance.on("tilesloaded", done),
        (done) => mapInstance.off("tilesloaded", done),
        MAP_PROVIDER.TENCENT
    );
    if (TMapInstance.service?.Geocoder) tencentGeocoder = new TMapInstance.service.Geocoder();
    if (TMapInstance.service?.Suggestion) tencentSuggestion = new TMapInstance.service.Suggestion({ pageSize: 10 });
    props.field.TencentMapConfig = { _TMap: TMapInstance, _map: mapInstance, Zoom: zoom, Center: center };

    _bindedTencentClick = isMapArea.value ? onTencentAreaClick : onTencentMapClick;
    _bindedTencentZoom = onTencentZoom;
    mapInstance.on("click", _bindedTencentClick);
    mapInstance.on("zoom", _bindedTencentZoom);
    if (isMapArea.value) {
        _bindedTencentMouseMove = onTencentAreaMouseMove;
        _bindedTencentRightClick = onTencentAreaRightClick;
        mapInstance.on("mousemove", _bindedTencentMouseMove);
        mapInstance.on("rightclick", _bindedTencentRightClick);
    }
    restoreTencentData();
    await renderPromise;
}

function waitForMapRender(addListener, removeListener, provider) {
    renderWaitCleanup();
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            try { removeListener(done); } catch { /* ignore */ }
            renderWaitCleanup = () => {};
            resolve();
        };
        const timer = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            try { removeListener(done); } catch { /* ignore */ }
            renderWaitCleanup = () => {};
            reject(new MapRuntimeError("MAP_SDK_RENDER_TIMEOUT", "Map tiles did not finish rendering before the timeout.", provider));
        }, RENDER_TIMEOUT);
        renderWaitCleanup = done;
        addListener(done);
    });
}

function destroyMap({ preserveState = false, invalidate = false } = {}) {
    if (invalidate) initializationId += 1;
    renderWaitCleanup();
    renderWaitCleanup = () => {};
    disconnectResizeObserver();
    try {
        if (mapInstance && activeProvider === MAP_PROVIDER.BAIDU) {
            if (_bindedBaiduClick) mapInstance.removeEventListener("click", _bindedBaiduClick);
            if (_bindedBaiduMouseMove) mapInstance.removeEventListener("mousemove", _bindedBaiduMouseMove);
            if (_bindedBaiduRightClick) mapInstance.removeEventListener("rightclick", _bindedBaiduRightClick);
            if (_bindedBaiduZoomEnd) mapInstance.removeEventListener("zoomend", _bindedBaiduZoomEnd);
            mapInstance.clearOverlays();
        } else if (mapInstance && activeProvider === MAP_PROVIDER.AMAP) {
            if (currentMarker) mapInstance.remove(currentMarker);
            if (currentLabel) mapInstance.remove(currentLabel);
            polylineOverlays.forEach((overlay) => mapInstance.remove(overlay));
            if (tempPolyline) mapInstance.remove(tempPolyline);
            mapInstance.destroy();
        } else if (mapInstance && activeProvider === MAP_PROVIDER.TENCENT) {
            if (_bindedTencentClick) mapInstance.off("click", _bindedTencentClick);
            if (_bindedTencentMouseMove) mapInstance.off("mousemove", _bindedTencentMouseMove);
            if (_bindedTencentRightClick) mapInstance.off("rightclick", _bindedTencentRightClick);
            if (_bindedTencentZoom) mapInstance.off("zoom", _bindedTencentZoom);
            removeTencentOverlay(currentMarker);
            removeTencentOverlay(currentLabel);
            polylineOverlays.forEach(removeTencentOverlay);
            removeTencentOverlay(tempPolyline);
            mapInstance.destroy?.();
        }
    } catch {
        // A partially initialized third-party SDK must never break form teardown.
    }
    mapInstance = null;
    activeProvider = "";
    BMapGL = null;
    AMapInstance = null;
    TMapInstance = null;
    currentMarker = null;
    currentLabel = null;
    polylineOverlays = [];
    polylinePaths = [];
    tempPolyline = null;
    currentDrawingPath = [];
    polylineEditing.value = false;
    amapGeocoder = null;
    amapPlaceSearch = null;
    tencentGeocoder = null;
    tencentSuggestion = null;
    _bindedBaiduClick = null;
    _bindedBaiduMouseMove = null;
    _bindedBaiduRightClick = null;
    _bindedBaiduZoomEnd = null;
    _bindedTencentClick = null;
    _bindedTencentMouseMove = null;
    _bindedTencentRightClick = null;
    _bindedTencentZoom = null;
    props.field.BaiduMapConfig = null;
    props.field.AmapConfig = null;
    props.field.TencentMapConfig = null;
    if (mapEl.value) mapEl.value.replaceChildren();
    if (!preserveState) mapState.value = "idle";
}

function getInitCenter() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (!isMapArea.value && !DiyCommon.IsNull(model[name + "_Lng"])) {
        return { lng: Number(model[name + "_Lng"]) || DEFAULT_CENTER.lng, lat: Number(model[name + "_Lat"]) || DEFAULT_CENTER.lat };
    }
    if (!DiyCommon.IsNull(model[name]) && !DiyCommon.IsNull(model[name].Center)) {
        const center = model[name].Center;
        if (Array.isArray(center)) return { lng: Number(center[0]) || DEFAULT_CENTER.lng, lat: Number(center[1]) || DEFAULT_CENTER.lat };
        return { lng: Number(center.lng) || DEFAULT_CENTER.lng, lat: Number(center.lat) || DEFAULT_CENTER.lat };
    }
    return { ...DEFAULT_CENTER };
}

function getInitZoom() {
    const value = props.FormDiyTableModel[props.field.Name]?.Zoom;
    if (!DiyCommon.IsNull(value)) return Number(value) || DEFAULT_ZOOM;
    return !isMapArea.value && !DiyCommon.IsNull(props.FormDiyTableModel[props.field.Name + "_Lng"])
        ? SELECTED_ZOOM
        : DEFAULT_ZOOM;
}

function getMarkerLabel() {
    return props.FormDiyTableModel[props.field.Name]?.Address || translate("MapSelectedHere", "您选择了这里");
}

function setAddressValue(address) {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (DiyCommon.IsNull(model[name])) model[name] = {};
    model[name].Address = address || "";
    emit("update:modelValue", model[name]);
}

function updateMapPointValue(lng, lat) {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    model[name + "_Lng"] = Number(lng) || 0;
    model[name + "_Lat"] = Number(lat) || 0;
    if (DiyCommon.IsNull(model[name])) model[name] = {};
    emit("update:modelValue", model[name]);
}

function updateMapAreaValue() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (DiyCommon.IsNull(model[name])) model[name] = {};
    model[name].Paths = polylinePaths;
    emit("update:modelValue", model[name]);
}

function updateViewportValue(center, zoom) {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (DiyCommon.IsNull(model[name])) model[name] = {};
    model[name].Zoom = Number(zoom) || DEFAULT_ZOOM;
    model[name].Center = { lng: Number(center.lng) || DEFAULT_CENTER.lng, lat: Number(center.lat) || DEFAULT_CENTER.lat };
}

// -------------------- Baidu --------------------
function restoreBaiduData() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (isMapArea.value) {
        if (Array.isArray(model[name]?.Paths)) {
            polylinePaths = model[name].Paths;
            redrawBaiduPolylines();
        }
    } else if (!DiyCommon.IsNull(model[name + "_Lng"])) {
        const point = new BMapGL.Point(model[name + "_Lng"], model[name + "_Lat"]);
        setBaiduMarker(point, getMarkerLabel());
        mapInstance.centerAndZoom(point, SELECTED_ZOOM);
    }
}

function onBaiduMapClick(event) {
    if (isDestroyed || !mapInstance) return;
    if (isMapArea.value) {
        if (!polylineEditing.value) return;
        appendDrawingPoint(event.latlng.lng, event.latlng.lat, redrawBaiduPolylines);
    } else if (props.FormMode !== "View") {
        setBaiduMarkerAndGeocode(new BMapGL.Point(event.latlng.lng, event.latlng.lat));
    }
}

function onBaiduMapMouseMove(event) {
    if (!canPreviewDrawing()) return;
    const points = currentLastPath().map((point) => new BMapGL.Point(point.lng, point.lat));
    points.push(new BMapGL.Point(event.latlng.lng, event.latlng.lat));
    if (tempPolyline) mapInstance.removeOverlay(tempPolyline);
    tempPolyline = new BMapGL.Polyline(points, { strokeColor: "#2f6feb", strokeWeight: 2, strokeOpacity: 0.55, strokeStyle: "dashed" });
    mapInstance.addOverlay(tempPolyline);
}

function onBaiduMapRightClick() {
    finishCurrentDrawing(redrawBaiduPolylines);
}

function onBaiduMapZoomEnd() {
    if (!mapInstance) return;
    const center = mapInstance.getCenter();
    updateViewportValue({ lng: center.lng, lat: center.lat }, mapInstance.getZoom());
}

function setBaiduMarker(point, labelText) {
    if (!mapInstance || !BMapGL) return;
    if (currentMarker) mapInstance.removeOverlay(currentMarker);
    if (currentLabel) mapInstance.removeOverlay(currentLabel);
    currentMarker = new BMapGL.Marker(point, { enableDragging: props.FormMode !== "View" });
    mapInstance.addOverlay(currentMarker);
    currentLabel = new BMapGL.Label(labelText || getMarkerLabel(), { offset: new BMapGL.Size(-35, 30), position: point });
    currentLabel.setStyle({ border: "1px solid #c9d2df", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", background: "#fff" });
    mapInstance.addOverlay(currentLabel);
    if (props.FormMode !== "View") {
        currentMarker.addEventListener("dragend", (event) => {
            if (!isDestroyed) setBaiduMarkerAndGeocode(new BMapGL.Point(event.point.lng, event.point.lat));
        });
    }
}

function setBaiduMarkerAndGeocode(point) {
    updateMapPointValue(point.lng, point.lat);
    setBaiduMarker(point, translate("MapSelectedHere", "您选择了这里"));
    mapInstance.panTo(point);
    new BMapGL.Geocoder().getLocation(point, (result) => {
        if (isDestroyed || !result) return;
        const address = result.address || "";
        currentLabel?.setContent(address || getMarkerLabel());
        setAddressValue(address);
    });
}

function redrawBaiduPolylines() {
    if (!mapInstance || !BMapGL) return;
    polylineOverlays.forEach((overlay) => mapInstance.removeOverlay(overlay));
    polylineOverlays = [];
    if (tempPolyline) mapInstance.removeOverlay(tempPolyline);
    tempPolyline = null;
    polylinePaths.forEach((path) => {
        if (path.length < 2) return;
        const overlay = new BMapGL.Polyline(path.map((point) => new BMapGL.Point(point.lng, point.lat)), {
            strokeColor: "#2f6feb", strokeWeight: 3, strokeOpacity: 0.85
        });
        mapInstance.addOverlay(overlay);
        polylineOverlays.push(overlay);
    });
}

// -------------------- AMap --------------------
function restoreAMapData() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (isMapArea.value) {
        if (Array.isArray(model[name]?.Paths)) {
            polylinePaths = model[name].Paths;
            redrawAMapPolylines();
        }
    } else if (!DiyCommon.IsNull(model[name + "_Lng"])) {
        const lng = Number(model[name + "_Lng"]) || 0;
        const lat = Number(model[name + "_Lat"]) || 0;
        setAMapMarker(lng, lat, getMarkerLabel());
        mapInstance.setZoomAndCenter(SELECTED_ZOOM, [lng, lat]);
    }
}

function onAMapClick(event) {
    if (props.FormMode === "View" || !mapInstance) return;
    const lng = event.lnglat.getLng();
    const lat = event.lnglat.getLat();
    updateMapPointValue(lng, lat);
    setAMapMarker(lng, lat, translate("MapSelectedHere", "您选择了这里"));
    amapReverseGeocode(lng, lat);
}

function onAMapAreaClick(event) {
    if (!polylineEditing.value) return;
    appendDrawingPoint(event.lnglat.getLng(), event.lnglat.getLat(), redrawAMapPolylines);
}

function onAMapAreaMouseMove(event) {
    if (!canPreviewDrawing() || !AMapInstance) return;
    const path = currentLastPath().map((point) => [point.lng, point.lat]);
    path.push([event.lnglat.getLng(), event.lnglat.getLat()]);
    if (tempPolyline) mapInstance.remove(tempPolyline);
    tempPolyline = new AMapInstance.Polyline({ path, strokeColor: "#2f6feb", strokeWeight: 2, strokeOpacity: 0.55, strokeStyle: "dashed" });
    mapInstance.add(tempPolyline);
}

function onAMapAreaRightClick() {
    finishCurrentDrawing(redrawAMapPolylines);
}

function onAMapZoomEnd() {
    if (!mapInstance) return;
    const center = mapInstance.getCenter();
    updateViewportValue({ lng: center.getLng(), lat: center.getLat() }, mapInstance.getZoom());
}

function setAMapMarker(lng, lat, label) {
    if (!mapInstance || !AMapInstance) return;
    if (currentMarker) mapInstance.remove(currentMarker);
    if (currentLabel) mapInstance.remove(currentLabel);
    currentMarker = new AMapInstance.Marker({ position: [lng, lat], draggable: props.FormMode !== "View" });
    currentLabel = new AMapInstance.Text({
        text: label || getMarkerLabel(),
        position: [lng, lat],
        offset: new AMapInstance.Pixel(20, 20),
        style: { border: "1px solid #c9d2df", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", background: "#fff" }
    });
    mapInstance.add([currentMarker, currentLabel]);
    mapInstance.setCenter([lng, lat]);
    if (props.FormMode !== "View") {
        currentMarker.on("dragend", () => {
            const position = currentMarker.getPosition();
            const nextLng = position.getLng();
            const nextLat = position.getLat();
            updateMapPointValue(nextLng, nextLat);
            currentLabel?.setPosition([nextLng, nextLat]);
            amapReverseGeocode(nextLng, nextLat);
        });
    }
}

function amapReverseGeocode(lng, lat) {
    amapGeocoder?.getAddress([lng, lat], (status, result) => {
        if (isDestroyed || status !== "complete" || result?.info !== "OK") return;
        const address = result.regeocode?.formattedAddress || "";
        currentLabel?.setText(address || getMarkerLabel());
        setAddressValue(address);
        if (props.field.AmapConfig) props.field.AmapConfig.Address = address;
    });
}

function redrawAMapPolylines() {
    if (!mapInstance || !AMapInstance) return;
    polylineOverlays.forEach((overlay) => mapInstance.remove(overlay));
    polylineOverlays = [];
    if (tempPolyline) mapInstance.remove(tempPolyline);
    tempPolyline = null;
    polylinePaths.forEach((path) => {
        if (path.length < 2) return;
        const overlay = new AMapInstance.Polyline({
            path: path.map((point) => [point.lng, point.lat]),
            strokeColor: "#2f6feb", strokeWeight: 3, strokeOpacity: 0.85
        });
        mapInstance.add(overlay);
        polylineOverlays.push(overlay);
    });
}

// -------------------- Tencent --------------------
function restoreTencentData() {
    const model = props.FormDiyTableModel;
    const name = props.field.Name;
    if (isMapArea.value) {
        if (Array.isArray(model[name]?.Paths)) {
            polylinePaths = model[name].Paths;
            redrawTencentPolylines();
        }
    } else if (!DiyCommon.IsNull(model[name + "_Lng"])) {
        const lng = Number(model[name + "_Lng"]) || 0;
        const lat = Number(model[name + "_Lat"]) || 0;
        setTencentMarker(lng, lat, getMarkerLabel());
        mapInstance.setCenter(new TMapInstance.LatLng(lat, lng));
        mapInstance.setZoom(SELECTED_ZOOM);
    }
}

function onTencentMapClick(event) {
    if (props.FormMode === "View" || !event?.latLng) return;
    const point = tencentLngLat(event.latLng);
    updateMapPointValue(point.lng, point.lat);
    setTencentMarker(point.lng, point.lat, translate("MapSelectedHere", "您选择了这里"));
    tencentReverseGeocode(point.lng, point.lat);
}

function onTencentAreaClick(event) {
    if (!polylineEditing.value || !event?.latLng) return;
    const point = tencentLngLat(event.latLng);
    appendDrawingPoint(point.lng, point.lat, redrawTencentPolylines);
}

function onTencentAreaMouseMove(event) {
    if (!canPreviewDrawing() || !event?.latLng || !TMapInstance) return;
    const point = tencentLngLat(event.latLng);
    const path = [...currentLastPath(), point].map((item) => new TMapInstance.LatLng(item.lat, item.lng));
    removeTencentOverlay(tempPolyline);
    tempPolyline = createTencentPolyline([{ id: "preview", styleId: "preview", paths: path }], true);
}

function onTencentAreaRightClick() {
    finishCurrentDrawing(redrawTencentPolylines);
}

function onTencentZoom() {
    if (!mapInstance) return;
    const center = tencentLngLat(mapInstance.getCenter());
    updateViewportValue(center, mapInstance.getZoom());
}

function tencentLngLat(value) {
    return {
        lng: Number(typeof value?.getLng === "function" ? value.getLng() : value?.lng) || 0,
        lat: Number(typeof value?.getLat === "function" ? value.getLat() : value?.lat) || 0
    };
}

function setTencentMarker(lng, lat, label) {
    if (!mapInstance || !TMapInstance) return;
    removeTencentOverlay(currentMarker);
    removeTencentOverlay(currentLabel);
    const position = new TMapInstance.LatLng(lat, lng);
    currentMarker = new TMapInstance.MultiMarker({
        id: `microi-marker-${props.field.Name}`,
        map: mapInstance,
        styles: {
            selected: new TMapInstance.MarkerStyle({
                width: 25,
                height: 35,
                anchor: { x: 12, y: 35 },
                src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png"
            })
        },
        geometries: [{ id: "selected", styleId: "selected", position }]
    });
    currentLabel = new TMapInstance.MultiLabel({
        id: `microi-label-${props.field.Name}`,
        map: mapInstance,
        styles: {
            selected: new TMapInstance.LabelStyle({
                color: "#24344d", size: 12, offset: { x: 18, y: 18 }, alignment: "left", verticalAlignment: "top"
            })
        },
        geometries: [{ id: "selected-label", styleId: "selected", position, content: label || getMarkerLabel() }]
    });
    mapInstance.setCenter(position);
}

async function tencentReverseGeocode(lng, lat) {
    if (!tencentGeocoder || !TMapInstance) return;
    try {
        const response = await tencentGeocoder.getAddress({ location: new TMapInstance.LatLng(lat, lng) });
        if (isDestroyed) return;
        const data = Array.isArray(response?.data) ? response.data[0] : (response?.result || response?.data || {});
        const address = data?.address || data?.formatted_addresses?.recommend || data?.formattedAddress || "";
        if (address) {
            setTencentMarker(lng, lat, address);
            setAddressValue(address);
        }
    } catch {
        // Reverse geocoding is an enhancement; the selected coordinates remain valid.
    }
}

function createTencentPolyline(geometries, preview = false) {
    return new TMapInstance.MultiPolyline({
        id: `microi-polyline-${props.field.Name}-${preview ? "preview" : Date.now()}`,
        map: mapInstance,
        styles: {
            line: new TMapInstance.PolylineStyle({ color: "#2f6feb", width: 4, borderWidth: 0 }),
            preview: new TMapInstance.PolylineStyle({ color: "rgba(47,111,235,.55)", width: 3, borderWidth: 0 })
        },
        geometries
    });
}

function redrawTencentPolylines() {
    if (!mapInstance || !TMapInstance) return;
    polylineOverlays.forEach(removeTencentOverlay);
    polylineOverlays = [];
    removeTencentOverlay(tempPolyline);
    tempPolyline = null;
    const geometries = polylinePaths
        .filter((path) => path.length >= 2)
        .map((path, index) => ({
            id: `line-${index}`,
            styleId: "line",
            paths: path.map((point) => new TMapInstance.LatLng(point.lat, point.lng))
        }));
    if (geometries.length) polylineOverlays.push(createTencentPolyline(geometries));
}

function removeTencentOverlay(overlay) {
    if (!overlay) return;
    try { overlay.setMap?.(null); } catch { /* ignore */ }
}

// -------------------- Search --------------------
function querySearch(queryString, callback) {
    const query = String(queryString || "").trim();
    if (!query || mapState.value !== "ready") return callback([]);
    if (isBaidu.value) return baiduQuerySearch(query, callback);
    if (isTencent.value) return tencentQuerySearch(query, callback);
    return amapQuerySearch(query, callback);
}

function baiduQuerySearch(query, callback) {
    if (!BMapGL || !mapInstance) return callback([]);
    const local = new BMapGL.LocalSearch(mapInstance, {
        onSearchComplete: (result) => {
            if (isDestroyed || local.getStatus() !== 0 || !result) return callback([]);
            const rows = [];
            for (let index = 0; index < result.getCurrentNumPois(); index += 1) {
                const poi = result.getPoi(index);
                rows.push({ value: `${poi.title || ""}${poi.address ? ` - ${poi.address}` : ""}`, point: poi.point });
            }
            callback(rows);
        }
    });
    local.search(query);
}

function amapQuerySearch(query, callback) {
    if (!amapPlaceSearch) return callback([]);
    amapPlaceSearch.search(query, (status, result) => {
        if (isDestroyed || status !== "complete" || !result?.poiList) return callback([]);
        callback(result.poiList.pois.map((poi) => ({
            value: `${poi.name || ""}${poi.address ? ` - ${poi.address}` : ""}`,
            location: poi.location
        })));
    });
}

async function tencentQuerySearch(query, callback) {
    const sequence = ++searchSequence;
    try {
        let response;
        if (tencentSuggestion) {
            response = await tencentSuggestion.getSuggestions({ keyword: query, location: mapInstance.getCenter() });
        } else if (tencentGeocoder) {
            response = await tencentGeocoder.getLocation({ address: query });
        } else {
            return callback([]);
        }
        if (isDestroyed || sequence !== searchSequence) return callback([]);
        const data = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.result?.data)
                ? response.result.data
                : response?.result?.location
                    ? [response.result]
                    : [];
        callback(data.slice(0, 10).map((item) => ({
            value: `${item.title || item.name || item.address || query}${item.address && (item.title || item.name) ? ` - ${item.address}` : ""}`,
            location: item.location || item.latLng
        })));
    } catch {
        callback([]);
    }
}

function handleSearchSelect(item) {
    if (isBaidu.value && item.point) {
        const point = new BMapGL.Point(item.point.lng, item.point.lat);
        setBaiduMarkerAndGeocode(point);
        mapInstance.centerAndZoom(point, SELECTED_ZOOM);
        return;
    }
    if (isAMap.value && item.location) {
        const lng = item.location.getLng();
        const lat = item.location.getLat();
        updateMapPointValue(lng, lat);
        setAMapMarker(lng, lat, item.value);
        mapInstance.setZoomAndCenter(SELECTED_ZOOM, [lng, lat]);
        amapReverseGeocode(lng, lat);
        return;
    }
    if (isTencent.value && item.location) {
        const point = tencentLngLat(item.location);
        updateMapPointValue(point.lng, point.lat);
        setTencentMarker(point.lng, point.lat, item.value);
        mapInstance.setZoom(SELECTED_ZOOM);
        tencentReverseGeocode(point.lng, point.lat);
    }
}

// -------------------- Area drawing --------------------
function appendDrawingPoint(lng, lat, redraw) {
    if (currentDrawingPath.length === 0) polylinePaths.push([]);
    const path = currentLastPath();
    path.push({ lng: Number(lng), lat: Number(lat) });
    currentDrawingPath = path;
    redraw();
}

function currentLastPath() {
    return polylinePaths[polylinePaths.length - 1] || [];
}

function canPreviewDrawing() {
    return !isDestroyed && mapInstance && polylineEditing.value && currentLastPath().length > 0;
}

function finishCurrentDrawing(redraw) {
    if (!polylineEditing.value || !mapInstance || currentLastPath().length === 0) return;
    currentDrawingPath = [];
    removeTemporaryPolyline();
    updateMapAreaValue();
    redraw();
}

function removeTemporaryPolyline() {
    if (!tempPolyline || !mapInstance) return;
    if (isBaidu.value) mapInstance.removeOverlay(tempPolyline);
    else if (isAMap.value) mapInstance.remove(tempPolyline);
    else removeTencentOverlay(tempPolyline);
    tempPolyline = null;
}

function toggleEditing() {
    polylineEditing.value = !polylineEditing.value;
    if (!polylineEditing.value) {
        currentDrawingPath = [];
        removeTemporaryPolyline();
        updateMapAreaValue();
        redrawCurrentPolylines();
    }
}

function clearPolyline() {
    polylinePaths = [];
    currentDrawingPath = [];
    removeTemporaryPolyline();
    if (isBaidu.value) polylineOverlays.forEach((overlay) => mapInstance.removeOverlay(overlay));
    else if (isAMap.value) polylineOverlays.forEach((overlay) => mapInstance.remove(overlay));
    else polylineOverlays.forEach(removeTencentOverlay);
    polylineOverlays = [];
    updateMapAreaValue();
}

function redrawCurrentPolylines() {
    if (isBaidu.value) redrawBaiduPolylines();
    else if (isTencent.value) redrawTencentPolylines();
    else redrawAMapPolylines();
}

// -------------------- Fullscreen and resizing --------------------
function toggleFullScreen() {
    isFullScreen.value = !isFullScreen.value;
    if (isFullScreen.value) {
        bodyOverflowBeforeFullscreen = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        bodyScrollLocked = true;
    } else {
        restoreBodyScroll();
    }
    if (mapInstance && isBaidu.value) mapInstance.enableScrollWheelZoom(isFullScreen.value);
    if (props.field.BaiduMapConfig) props.field.BaiduMapConfig.ScrollWheelZoom = isFullScreen.value;
    if (mapInstance && isAMap.value) mapInstance.setStatus?.({ scrollWheel: isFullScreen.value });
    nextTick(scheduleResize);
}

function onKeydown(event) {
    if (event.key === "Escape" && isFullScreen.value) toggleFullScreen();
}

function restoreBodyScroll() {
    if (!bodyScrollLocked) return;
    document.body.style.overflow = bodyOverflowBeforeFullscreen;
    bodyOverflowBeforeFullscreen = "";
    bodyScrollLocked = false;
    isFullScreen.value = false;
}

function installResizeObserver() {
    disconnectResizeObserver();
    if (typeof ResizeObserver === "undefined" || !mapContainer.value) return;
    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(mapContainer.value);
}

function disconnectResizeObserver() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
}

function scheduleResize() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
        if (!mapInstance) return;
        try {
            if (isAMap.value) mapInstance.resize();
            else if (isTencent.value) mapInstance.resize?.();
            else if (isBaidu.value) mapInstance.checkResize?.();
        } catch {
            // SDK resize differences are non-fatal.
        }
    });
}
</script>

<style scoped>
.form-map {
    width: 100%;
    --map-accent: var(--el-color-primary, #409eff);
    --map-panel: var(--el-bg-color, #fff);
    --map-text: var(--el-text-color-primary, #1f2d3d);
    --map-muted: var(--el-text-color-secondary, #66758a);
    --map-line: var(--el-border-color, #d9e0ea);
}

.map-container {
    position: relative;
    width: 100%;
    height: 320px;
    min-height: 240px;
    overflow: hidden;
    border: 1px solid var(--map-line);
    border-radius: 12px;
    background: var(--el-fill-color-light, #f5f7fa);
    isolation: isolate;
}

.map-container.fullscreen-map {
    position: fixed;
    inset: 0;
    z-index: 2200;
    width: 100vw !important;
    height: 100vh !important;
    border: 0;
    border-radius: 0;
}

.map-view {
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity .2s ease;
}

.map-view.is-ready { opacity: 1; }

.map-status {
    position: absolute;
    inset: 0;
    z-index: 90;
    display: grid;
    place-content: center;
    justify-items: center;
    padding: 24px;
    color: var(--map-text);
    text-align: center;
    background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--map-accent) 10%, transparent), transparent 42%), var(--el-fill-color-lighter, #f7f9fc);
}

.map-status strong { margin-top: 12px; font-size: 15px; }
.map-status p { max-width: 620px; margin: 7px 0 0; color: var(--map-muted); font-size: 12px; line-height: 1.65; }

.map-loader {
    width: 30px;
    height: 30px;
    border: 3px solid color-mix(in srgb, var(--map-accent) 18%, transparent);
    border-top-color: var(--map-accent);
    border-radius: 50%;
    animation: map-spin .8s linear infinite;
}

.map-status--error {
    grid-template-columns: 44px minmax(0, 620px);
    column-gap: 14px;
    place-items: start;
    text-align: left;
    background: linear-gradient(135deg, color-mix(in srgb, var(--el-color-danger, #f56c6c) 7%, transparent), transparent 45%), var(--map-panel);
}

.map-error-icon {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border-radius: 13px;
    color: #fff;
    background: var(--el-color-danger, #f56c6c);
    font-size: 22px;
    font-weight: 800;
    box-shadow: 0 8px 22px color-mix(in srgb, var(--el-color-danger, #f56c6c) 24%, transparent);
}

.map-error-copy { min-width: 0; }
.map-error-copy strong { display: block; margin: 0; font-size: 16px; }
.map-error-copy small { display: block; max-width: 620px; margin-top: 6px; overflow-wrap: anywhere; color: var(--map-muted); font-size: 11px; line-height: 1.55; }
.map-error-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }

.map-error-meta span,
.map-error-meta code,
.map-provider-badge {
    padding: 3px 8px;
    border-radius: 999px;
    color: var(--map-accent);
    background: color-mix(in srgb, var(--map-accent) 10%, var(--map-panel));
    font-size: 10px;
    font-weight: 700;
}

.map-error-meta code { color: var(--map-muted); background: var(--el-fill-color, #eef1f5); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.map-error-copy .map-settings-path { margin: 10px 0 13px; padding-left: 9px; border-left: 3px solid color-mix(in srgb, var(--map-accent) 55%, transparent); color: var(--map-text); }

.map-controls,
.map-search-box,
.map-provider-badge { position: absolute; z-index: 40; }
.map-controls { top: 12px; left: 12px; display: flex; flex-wrap: wrap; gap: 7px; }
.map-controls :deep(.el-button + .el-button) { margin-left: 0; }
.map-search-box { top: 12px; right: 12px; width: min(300px, calc(100% - 24px)); }
.map-search-box :deep(.el-autocomplete) { width: 100%; }

.map-provider-badge {
    bottom: 10px;
    left: 10px;
    color: var(--map-text);
    background: color-mix(in srgb, var(--map-panel) 88%, transparent);
    box-shadow: 0 4px 14px rgba(20, 34, 54, .12);
    backdrop-filter: blur(8px);
}

.form-item-tip { margin-top: 7px; color: var(--map-muted); font-size: 12px; line-height: 1.6; }

@keyframes map-spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
    .map-container { height: 300px; }
    .map-controls { top: 9px; left: 9px; }
    .map-search-box { top: 55px; right: 9px; width: calc(100% - 18px); }
    .map-status--error { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .map-error-copy .map-settings-path { text-align: left; }
    .map-error-meta { justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
    .map-view { transition: none; }
    .map-loader { animation-duration: 1.6s; }
}
</style>
