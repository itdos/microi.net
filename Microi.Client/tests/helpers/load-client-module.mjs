import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Use the same JSON and alias resolution as the client without opening a port.
export async function loadClientModule(moduleUrl, options = {}) {
    const clientRoot = fileURLToPath(new URL("../../", import.meta.url));
    const server = await createServer({
        configFile: false,
        root: clientRoot,
        logLevel: "error",
        optimizeDeps: { noDiscovery: true, include: [] },
        resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null }
    });
    try {
        if (options.locale) {
            const { default: i18n } = await server.ssrLoadModule(fileURLToPath(new URL("../../src/lang/index.js", import.meta.url)));
            i18n.global.locale = options.locale;
        }
        return await server.ssrLoadModule(fileURLToPath(moduleUrl));
    } finally {
        await server.close();
    }
}
