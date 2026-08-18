function ensureConfigObject(field) {
    if (!field || typeof field !== "object") return null;

    if (typeof field.Config === "string") {
        try {
            field.Config = field.Config ? JSON.parse(field.Config) : {};
        } catch (error) {
            field.Config = {};
        }
    }
    if (!field.Config || typeof field.Config !== "object" || Array.isArray(field.Config)) {
        field.Config = {};
    }
    return field.Config;
}

/**
 * diy_field does not have a physical V8Code column.  Historical/runtime code
 * stores the value-change handler in Config.V8Code, while the generic field
 * property form edits a temporary root-level V8Code property. API DTOs may
 * still contain a root-level empty-string placeholder, so Config.V8Code is the
 * source of truth whenever a server/list field is hydrated.
 */
export function hydrateFieldValueChangeV8(field) {
    const config = ensureConfigObject(field);
    if (!config) return field;

    field.V8Code = config.V8Code == null ? "" : String(config.V8Code);
    return field;
}

/** Persist the generic property-form alias into the real diy_field.Config. */
export function persistFieldValueChangeV8(field) {
    const config = ensureConfigObject(field);
    if (!config) return field;

    if (Object.prototype.hasOwnProperty.call(field, "V8Code")) {
        config.V8Code = field.V8Code == null ? "" : String(field.V8Code);
    }
    return field;
}

export function setFieldValueChangeV8(field, value) {
    if (!field || typeof field !== "object") return field;
    field.V8Code = value == null ? "" : String(value);
    return persistFieldValueChangeV8(field);
}
