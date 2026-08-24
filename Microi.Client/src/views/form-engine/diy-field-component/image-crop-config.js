const VALID_CROP_MODES = new Set(['free', 'fixed', 'select']);

export const IMAGE_CROP_RATIOS = Object.freeze([
    { value: 'free', label: '自由' },
    { value: '1:1', label: '1 : 1' },
    { value: '4:3', label: '4 : 3' },
    { value: '3:4', label: '3 : 4' },
    { value: '16:9', label: '16 : 9' },
    { value: '9:16', label: '9 : 16' },
    { value: '3:2', label: '3 : 2' },
    { value: '2:3', label: '2 : 3' },
    { value: 'custom', label: '自定义' }
]);

export const DEFAULT_IMAGE_CROP_CONFIG = Object.freeze({
    Enabled: false,
    Mode: 'free',
    Ratio: '1:1',
    CustomWidth: 1,
    CustomHeight: 1,
    AllowRotate: true,
    AllowFlip: true,
    AllowZoom: true
});

const toBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') {
        return false;
    }
    return true;
};

const positiveNumber = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(10000, Math.max(1, Math.round(parsed * 100) / 100));
};

export const normalizeImageCropConfig = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    const mode = VALID_CROP_MODES.has(source.Mode) ? source.Mode : DEFAULT_IMAGE_CROP_CONFIG.Mode;
    const validRatio = IMAGE_CROP_RATIOS.some(item => item.value === source.Ratio)
        ? source.Ratio
        : DEFAULT_IMAGE_CROP_CONFIG.Ratio;

    return {
        Enabled: toBoolean(source.Enabled, DEFAULT_IMAGE_CROP_CONFIG.Enabled),
        Mode: mode,
        Ratio: mode === 'free' ? 'free' : (validRatio === 'free' ? DEFAULT_IMAGE_CROP_CONFIG.Ratio : validRatio),
        CustomWidth: positiveNumber(source.CustomWidth, DEFAULT_IMAGE_CROP_CONFIG.CustomWidth),
        CustomHeight: positiveNumber(source.CustomHeight, DEFAULT_IMAGE_CROP_CONFIG.CustomHeight),
        AllowRotate: toBoolean(source.AllowRotate, DEFAULT_IMAGE_CROP_CONFIG.AllowRotate),
        AllowFlip: toBoolean(source.AllowFlip, DEFAULT_IMAGE_CROP_CONFIG.AllowFlip),
        AllowZoom: toBoolean(source.AllowZoom, DEFAULT_IMAGE_CROP_CONFIG.AllowZoom)
    };
};

export const resolveCropAspectRatio = (config, runtimeRatio) => {
    const normalized = normalizeImageCropConfig(config);
    const selected = normalized.Mode === 'free'
        ? 'free'
        : (runtimeRatio || normalized.Ratio);
    if (selected === 'free') return Number.NaN;
    if (selected === 'custom') {
        return normalized.CustomWidth / normalized.CustomHeight;
    }

    const parts = String(selected).split(':').map(Number);
    if (parts.length !== 2 || !parts.every(item => Number.isFinite(item) && item > 0)) {
        return 1;
    }
    return parts[0] / parts[1];
};

export const isCropSupportedImage = (file) => {
    const mimeType = String(file?.type || '').toLowerCase();
    return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
};

export const getCropOutputMimeType = (file) => {
    const mimeType = String(file?.type || '').toLowerCase();
    return isCropSupportedImage(file) ? mimeType : 'image/jpeg';
};
