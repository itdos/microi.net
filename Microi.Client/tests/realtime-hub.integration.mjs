import assert from "node:assert/strict";
import * as signalR from "@microsoft/signalr";

const mainBackend = String(process.env.BACKEND || "https://localhost:61501").replace(/\/$/, "");
const childBackend = String(process.env.LXWB_BACKEND || mainBackend).replace(/\/$/, "");

async function login(backend, osClient, account, password) {
    assert.ok(password, `password for ${osClient} is required`);
    const did = `codex-signalr-${osClient.toLowerCase()}-${Date.now()}`;
    const response = await fetch(`${backend}/api/SysUser/Login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            OsClient: osClient,
            did
        },
        body: JSON.stringify({
            Account: account,
            Pwd: password,
            OsClient: osClient,
            _AutomationTestLogin: true,
            _ClientType: "PC"
        })
    });
    const result = await response.json();
    assert.equal(result.Code, 1, `${osClient} login failed: ${JSON.stringify(result).slice(0, 500)}`);
    const token = result.Data?.Token || result.Token || response.headers.get("authorization");
    assert.ok(token, `${osClient} login did not return a token`);
    return { token: String(token).replace(/^Bearer\s+/i, ""), did, user: result.Data || {} };
}

function createConnection(backend, osClient, identity) {
    const query = new URLSearchParams({ OsClient: osClient, DeviceClientId: identity.did });
    return new signalR.HubConnectionBuilder()
        .withUrl(`${backend}/diy-websocket?${query}`, {
            accessTokenFactory: () => identity.token
        })
        .build();
}

async function waitFor(predicate, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail("condition was not reached before timeout");
}

async function verifyTenant(backend, osClient, password) {
    const identity = await login(backend, osClient, "admin", password);
    const connection = createConnection(backend, osClient, identity);
    let lastContacts = null;
    let unreadCount = null;
    connection.on("ReceiveSendLastContacts", value => { lastContacts = value; });
    connection.on("ReceiveSendUnreadCountToUser", value => { unreadCount = value; });

    try {
        await connection.start();
        await new Promise(resolve => setTimeout(resolve, 800));
        assert.equal(connection.state, signalR.HubConnectionState.Connected, `${osClient} was aborted after handshake`);

        // Hub methods must ignore forged tenant/user fields and bind the current Token identity.
        await connection.invoke("SendLastContacts", {
            UserId: "forged-user",
            ContactUserId: "",
            OsClient: "forged-tenant"
        });
        await connection.invoke("SendUnreadCountToUser", {
            ToUserId: "forged-user",
            OsClient: "forged-tenant"
        });
        await waitFor(() => Array.isArray(lastContacts) && Number.isFinite(Number(unreadCount)));
        return { osClient, contacts: lastContacts.length, unreadCount: Number(unreadCount), identity };
    } finally {
        await connection.stop().catch(() => {});
    }
}

async function verifyCrossTenantRejection(backend, identity, otherOsClient) {
    const connection = createConnection(backend, otherOsClient, identity);
    try {
        await connection.start().catch(() => {});
        await waitFor(() => connection.state === signalR.HubConnectionState.Disconnected, 5000);
        await assert.rejects(
            connection.invoke("SendLastContacts", { UserId: identity.user?.Id, OsClient: otherOsClient }),
            /Connected State|connection|disconnected/i
        );
    } finally {
        await connection.stop().catch(() => {});
    }
}

const main = await verifyTenant(mainBackend, "iTdos", process.env.ITDOS_PASSWORD);
const skipChild = /^(1|true)$/i.test(String(process.env.SKIP_CHILD || ""));
const child = skipChild
    ? null
    : await verifyTenant(childBackend, "lxwb", process.env.LXWB_PASSWORD);
await verifyCrossTenantRejection(
    skipChild ? mainBackend : childBackend,
    main.identity,
    "lxwb"
);

console.log(JSON.stringify({
    ok: true,
    tenants: [
        { osClient: main.osClient, contacts: main.contacts, unreadCount: main.unreadCount },
        child && { osClient: child.osClient, contacts: child.contacts, unreadCount: child.unreadCount }
    ].filter(Boolean),
    childTenantSkipped: skipChild,
    crossTenantTokenRejected: true
}));
