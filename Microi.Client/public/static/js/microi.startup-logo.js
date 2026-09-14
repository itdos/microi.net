/* 启动层先于 Vue 执行，保持 ES5；缓存和最新系统设置共用同一套 Logo 回退逻辑。 */
(function () {
    var revision = 0;
    function resolveLogo(config) {
        var value = config && config.SysLogo;
        try {
            if (typeof value === 'string') {
                value = value.trim();
                if (/^[\[{]/.test(value)) value = JSON.parse(value);
            }
            if (Array.isArray(value)) value = value[0];
            if (value && typeof value === 'object') value = value.Path || value.path;
            if (typeof value !== 'string' || !value.trim()) return '';
            value = value.trim();
            var base = typeof config.FileServer === 'string' ? config.FileServer.replace(/\/+$/, '') : '';
            var url = /^(https?:)?\/\//i.test(value) ? value : (base ? base + '/' + value.replace(/^\/+/, '') : value);
            // Logo 只接受网络或相对资源，不能把缓存字段作为 HTML 或可执行 URL 使用。
            if (/[\u0000-\u0020\\]/.test(url) || (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:\/\//i.test(url))) return '';
            if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return '';
            return url;
        } catch (e) { return ''; }
    }
    window.MicroiSetStartupLogo = function (config) {
        var current = ++revision;
        var core = document.getElementById('logoCore');
        var ring = document.getElementById('startupLogoRing');
        var fallback = document.getElementById('startupDefaultLogo');
        var tenant = document.getElementById('startupTenantLogo');
        if (!core || !ring || !fallback || !tenant) return;
        fallback.hidden = false;
        tenant.hidden = true;
        core.classList.add('has-default-logo');
        core.classList.remove('has-custom-logo');
        ring.classList.add('has-default-logo');
        var url = resolveLogo(config);
        if (!url) return;
        var probe = new Image();
        // 加载成功才替换；旧缓存请求晚于新配置返回时，不得覆盖最新品牌。
        probe.onload = function () {
            if (current !== revision || !document.getElementById('logoCore')) return;
            tenant.src = url;
            tenant.hidden = false;
            fallback.hidden = true;
            core.classList.remove('has-default-logo');
            core.classList.add('has-custom-logo');
            ring.classList.remove('has-default-logo');
        };
        probe.onerror = function () { /* 保留默认图标，不递归重试，也不影响应用启动。 */ };
        probe.src = url;
    };
}());
