import assert from "node:assert/strict";
import test from "node:test";

const properties = new Map();
const attributes = new Map();
let mode = "dark";

globalThis.document = {
    documentElement: {
        style: {
            setProperty(name, value) {
                properties.set(name, String(value));
            }
        },
        classList: {
            add() {},
            remove() {}
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.get(name) || null;
        }
    }
};

globalThis.localStorage = {
    getItem(key) {
        return key === "mci-theme" ? mode : null;
    },
    setItem(key, value) {
        if (key === "mci-theme") mode = value;
    }
};

globalThis.getComputedStyle = () => ({
    getPropertyValue(name) {
        return properties.get(name) || "";
    }
});

const theme = await import("../src/utils/theme-color.js");

function applyPalette(nextMode, palette) {
    mode = nextMode;
    theme.setThemeColor(palette.value);
    return Object.fromEntries([
        "--mci-bg-page",
        "--mci-bg-content",
        "--mci-bg-header",
        "--mci-bg-overlay",
        "--mci-skeleton-surface",
        "--mci-skeleton-card",
        "--mci-skeleton-header",
        "--mci-skeleton-base",
        "--mci-skeleton-highlight",
        "--mci-skeleton-accent",
        "--mci-skeleton-border",
        "--sidebar-bg-color",
        "--sidebar-active-bg",
        "--sidebar-footer-wave-bg",
        "--sidebar-footer-text-color",
        "--sidebar-active-text-color",
        "--mci-color-primary",
        "--mci-text-on-primary",
        "--mci-presentation-header-bg",
        "--mci-presentation-metric-strip-bg",
        "--mci-presentation-metric-bg",
        "--mci-presentation-primary-text"
    ].map(name => [name, properties.get(name)]));
}

test("light and dark modes expose twelve non-conflicting palettes", () => {
    const light = theme.getThemePalettes("light");
    const dark = theme.getThemePalettes("dark");

    assert.equal(light.length, 12);
    assert.equal(dark.length, 12);
    assert.ok(light.some(item => item.key === "white"));
    assert.ok(!dark.some(item => item.key === "white"));
});

test("every dark palette drives a distinct full surface hierarchy", () => {
    const rows = theme.getThemePalettes("dark").map(palette => ({
        key: palette.key,
        tokens: applyPalette("dark", palette)
    }));

    for (const name of [
        "--mci-bg-page",
        "--mci-bg-content",
        "--mci-bg-header",
        "--mci-bg-overlay",
        "--sidebar-bg-color"
    ]) {
        assert.equal(new Set(rows.map(row => row.tokens[name])).size, rows.length, name);
    }

    for (const row of rows) {
        const tokens = row.tokens;
        assert.notEqual(tokens["--sidebar-bg-color"], tokens["--sidebar-footer-wave-bg"], row.key);
        assert.ok(
            theme.getContrastRatio(
                tokens["--sidebar-bg-color"],
                tokens["--sidebar-footer-wave-bg"]
            ) >= 1.18,
            `${row.key} wave visibility`
        );
        assert.ok(
            theme.getContrastRatio(
                tokens["--sidebar-footer-text-color"],
                tokens["--sidebar-footer-wave-bg"]
            ) >= 4.5,
            `${row.key} footer contrast`
        );
        assert.ok(
            theme.getContrastRatio(
                tokens["--sidebar-active-text-color"],
                tokens["--sidebar-active-bg"]
            ) >= 4.5,
            `${row.key} active menu contrast`
        );
    }
});

test("footer wave remains distinct and readable in every light palette", () => {
    for (const palette of theme.getThemePalettes("light")) {
        const tokens = applyPalette("light", palette);
        assert.notEqual(tokens["--sidebar-bg-color"], tokens["--sidebar-footer-wave-bg"], palette.key);
        assert.ok(
            theme.getContrastRatio(
                tokens["--sidebar-bg-color"],
                tokens["--sidebar-footer-wave-bg"]
            ) >= 1.18,
            `${palette.key} wave visibility`
        );
        assert.ok(
            theme.getContrastRatio(
                tokens["--sidebar-footer-text-color"],
                tokens["--sidebar-footer-wave-bg"]
            ) >= 4.5,
            `${palette.key} footer contrast`
        );
    }
});

test("every palette keeps primary controls readable in both modes", () => {
    for (const nextMode of ["light", "dark"]) {
        for (const palette of theme.getThemePalettes(nextMode)) {
            const tokens = applyPalette(nextMode, palette);
            assert.ok(
                theme.getContrastRatio(
                    tokens["--mci-text-on-primary"],
                    tokens["--mci-color-primary"]
                ) >= 4.5,
                `${nextMode} ${palette.key} primary contrast`
            );
            assert.ok(
                theme.getContrastRatio(
                    tokens["--mci-presentation-primary-text"],
                    properties.get("--mci-bg-card")
                ) >= 4.5,
                `${nextMode} ${palette.key} presentation contrast`
            );
            const primaryRgb = theme.hexToRgb(tokens["--mci-color-primary"]);
            assert.match(
                tokens["--mci-presentation-header-bg"],
                new RegExp(`rgba\\(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b},`)
            );
            assert.match(tokens["--mci-presentation-metric-strip-bg"], /linear-gradient/);
            assert.match(tokens["--mci-presentation-metric-bg"], /linear-gradient/);
        }
    }

    for (const palette of theme.MCI_THEME_PALETTES) {
        assert.ok(
            theme.getContrastRatio(palette.onPrimary, palette.value) >= 4.5,
            `${palette.key} swatch contrast`
        );
    }
});

test("every palette exposes distinct, low-saturation skeleton surfaces in both modes", () => {
    for (const nextMode of ["light", "dark"]) {
        for (const palette of theme.getThemePalettes(nextMode)) {
            const tokens = applyPalette(nextMode, palette);
            assert.ok(tokens["--mci-skeleton-surface"], `${nextMode} ${palette.key} surface`);
            assert.ok(tokens["--mci-skeleton-card"], `${nextMode} ${palette.key} card`);
            assert.notEqual(tokens["--mci-skeleton-base"], tokens["--mci-skeleton-highlight"], `${nextMode} ${palette.key} shimmer`);
            assert.match(tokens["--mci-skeleton-accent"], /^rgba\(/, `${nextMode} ${palette.key} accent`);
            assert.ok(
                theme.getContrastRatio(
                    tokens["--mci-skeleton-base"],
                    tokens["--mci-skeleton-highlight"]
                ) >= 1.04,
                `${nextMode} ${palette.key} skeleton hierarchy`
            );
        }
    }
});

test("dark custom near-white and near-black colors stay usable", () => {
    mode = "dark";

    assert.equal(theme.setThemeColor("#FFFFFF"), "#2563EB");
    assert.equal(attributes.get("data-mci-palette"), "blue");
    assert.equal(properties.get("--mci-color-primary"), "#2563EB");

    assert.equal(theme.setThemeColor("#000000"), "#000000");
    assert.equal(attributes.get("data-mci-palette"), "custom");
    assert.equal(properties.get("--mci-palette-value"), "#000000");
    assert.equal(properties.get("--mci-color-primary"), "#64748B");
    assert.ok(
        theme.getContrastRatio(
            properties.get("--mci-text-on-primary"),
            properties.get("--mci-color-primary")
        ) >= 4.5
    );
});
