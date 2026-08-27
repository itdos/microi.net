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
 * Historical tenants and official application packages store field/button V8
 * in the physical diy_field.V8Code column. Some newer clients also mirrored it
 * into Config.V8Code. Prefer a non-empty physical value, fall back to Config,
 * and then synchronize both slots so either storage generation remains safe.
 */
export function hydrateFieldValueChangeV8(field) {
    const config = ensureConfigObject(field);
    if (!config) return field;

    const physicalCode = field.V8Code == null ? "" : String(field.V8Code);
    const configCode = config.V8Code == null ? "" : String(config.V8Code);
    const resolvedCode = physicalCode || configCode;
    field.V8Code = resolvedCode;
    config.V8Code = resolvedCode;
    return field;
}

/** Persist the editor value into both supported storage generations. */
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
