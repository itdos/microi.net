import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Use the same JSON and alias resolution as the client without opening a port.
export async function loadClientModule(moduleUrl) {
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
        return await server.ssrLoadModule(fileURLToPath(moduleUrl));
    } finally {
        await server.close();
    }
}
