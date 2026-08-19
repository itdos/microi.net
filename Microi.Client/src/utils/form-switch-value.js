/**
 * Normalize FormEngine switch values to Element Plus' numeric active/inactive values.
 *
 * Form metadata and older APIs can return 0/1 as strings. JavaScript truthiness is
 * not suitable here because both "0" and "false" are truthy strings.
 */
export function normalizeFormSwitchValue(value) {
    if (value === true || value === 1) return 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "1" || normalized === "true" ? 1 : 0;
    }
    return 0;
}

export default normalizeFormSwitchValue;
