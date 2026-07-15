const DEFAULT_ROLE_PERMISSIONS = ["Add", "Edit", "Del", "Export", "Import"];
const ROLE_BUTTON_GROUPS = ["MoreBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs", "FormBtns"];

export function setRoleMenuChecked(row, checked) {
    if (!row || typeof row !== "object") return;

    row._Check = checked === true;
    if (row._Check) {
        const permissions = [...DEFAULT_ROLE_PERMISSIONS];
        ROLE_BUTTON_GROUPS.forEach((buttonGroup) => {
            if (!Array.isArray(row[buttonGroup])) return;
            row[buttonGroup].forEach((button) => {
                if (button?.Id && !permissions.includes(button.Id)) {
                    permissions.push(button.Id);
                }
            });
        });
        row.Permission = permissions;
    } else {
        row.Permission = [];
    }

    if (Array.isArray(row._Child)) {
        row._Child.forEach((child) => setRoleMenuChecked(child, checked));
    }
}
