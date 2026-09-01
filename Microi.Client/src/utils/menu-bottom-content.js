export const DEFAULT_MENU_BOTTOM_CONTENT = `<div class="col-md-12">
     {{ OsVersion }}
</div>
<div class="col-md-12">
     Copyright © 2009 - {{ YYYY }}
</div>`;

export function resolveMenuBottomContent({
    content,
    osVersion = "",
    companyName = "",
    sysTitle = "",
    year = new Date().getFullYear()
} = {}) {
    // 租户已配置的内容始终优先；只有空值才启用框架默认版权信息。
    const source = typeof content === "string" && content.trim()
        ? content
        : DEFAULT_MENU_BOTTOM_CONTENT;

    return source
        .replace(/\$OsVersion\$/g, osVersion)
        .replace(/\{\{\s*OsVersion\s*\}\}/g, osVersion)
        .replace(/\$CompanyName\$/g, companyName)
        .replace(/\{\{\s*CompanyName\s*\}\}/g, companyName)
        .replace(/\$SysTitle\$/g, sysTitle)
        .replace(/\{\{\s*SysTitle\s*\}\}/g, sysTitle)
        .replace(/\$YYYY\$/g, String(year))
        .replace(/\{\{\s*YYYY\s*\}\}/g, String(year));
}
