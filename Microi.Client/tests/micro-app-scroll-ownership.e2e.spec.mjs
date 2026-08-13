import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

const executablePath = process.env.PW_BROWSER_EXECUTABLE || process.env.PW_CHROMIUM_EXECUTABLE || undefined;

test.use({
    viewport: { width: 900, height: 700 },
    ...(executablePath ? { launchOptions: { executablePath } } : {})
});

function extractRule(source, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(`^${escaped}\\s*\\{([\\s\\S]*?)^\\}`, "m"));
    assertRule(match, selector);
    return `${selector} {${match[1]}}`;
}

function assertRule(match, selector) {
    if (!match) throw new Error(`Missing ${selector} rule in micro-app host`);
}

async function activeVerticalScrollOwners(page) {
    return page.locator(".micro-app-host").evaluate((host) => (
        [host, ...host.querySelectorAll("*")]
            .filter((element) => {
                const overflowY = getComputedStyle(element).overflowY;
                return element.scrollHeight > element.clientHeight + 1
                    && (overflowY === "auto" || overflowY === "scroll");
            })
            .map((element) => element.getAttribute("data-scroll-owner") || element.tagName.toLowerCase())
    ));
}

test("framework fallback and child adaptive scrolling never create two vertical scrollbars", async ({ page }) => {
    const source = await fs.readFile(new URL("../src/views/micro-app/host.vue", import.meta.url), "utf8");
    const hostCss = extractRule(source, ".micro-app-host");
    const appCss = extractRule(source, ".micro-app-host__app");

    await page.setContent(`
        <style>
            html, body { margin: 0; }
            ${hostCss}
            ${appCss}
            .micro-app-host.fixture {
                --micro-app-available-width: 520px;
                --micro-app-available-height: 320px;
                --micro-app-safe-area-bottom: 0px;
                width: 520px;
                height: 320px !important;
                min-height: 320px !important;
            }
            .fixture-app { flex: 0 0 320px; }
            .child-content { height: 820px; background: linear-gradient(#fff, #d9ebff); }
            .fixture-app.child-owned .child-scroll {
                height: 320px;
                overflow-y: auto;
            }
        </style>
        <div class="micro-app-host fixture" data-scroll-owner="host">
            <micro-app class="micro-app-host__app fixture-app" data-scroll-owner="app">
                <section class="child-scroll" data-scroll-owner="child">
                    <div class="child-content"></div>
                </section>
            </micro-app>
        </div>
    `);

    const host = page.locator(".micro-app-host");
    const app = page.locator(".fixture-app");
    const child = page.locator(".child-scroll");

    await expect.poll(() => activeVerticalScrollOwners(page)).toEqual(["app"]);
    await app.hover();
    await page.mouse.wheel(0, 220);
    await expect.poll(() => app.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await host.evaluate((element) => element.scrollTop)).toBe(0);
    expect(await child.evaluate((element) => element.scrollTop)).toBe(0);

    await app.evaluate((element) => {
        element.scrollTop = 0;
        element.classList.add("child-owned");
    });

    await expect.poll(() => activeVerticalScrollOwners(page)).toEqual(["child"]);
    await child.hover();
    await page.mouse.wheel(0, 220);
    await expect.poll(() => child.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await host.evaluate((element) => element.scrollTop)).toBe(0);
    expect(await app.evaluate((element) => element.scrollTop)).toBe(0);
});
