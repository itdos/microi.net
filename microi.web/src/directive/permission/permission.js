import { useUserStore } from "@/stores";

function checkPermission(el, binding) {
    const { value } = binding;
    const userStore = useUserStore();
    const roles = userStore.roles;

    if (value && value instanceof Array) {
        if (value.length > 0) {
            const permissionRoles = value;

            const hasPermission = roles.some((role) => {
                return permissionRoles.includes(role);
            });

            if (!hasPermission) {
                el.parentNode && el.parentNode.removeChild(el);
            }
        }
    } else {
        throw new Error(`need roles! Like v-permission="['admin','editor']"`);
    }
}

export default {
    // Vue 3: inserted -> mounted
    mounted(el, binding) {
        checkPermission(el, binding);
    },
    // Vue 3: update -> updated
    updated(el, binding) {
        checkPermission(el, binding);
    }
};
