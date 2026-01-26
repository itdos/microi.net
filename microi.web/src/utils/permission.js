import { useUserStore } from "@/pinia";

/**
 * @param {Array} value
 * @returns {Boolean}
 * @example see @/views/permission/directive.vue
 */
export default function checkPermission(value) {
    if (value && value instanceof Array && value.length > 0) {
        const userStore = useUserStore();
        const roles = userStore.roles;
        const permissionRoles = value;

        const hasPermission = roles.some((role) => {
            return permissionRoles.includes(role);
        });
        return hasPermission;
    } else {
        console.error(`need roles! Like v-permission="['admin','editor']"`);
        return false;
    }
}
