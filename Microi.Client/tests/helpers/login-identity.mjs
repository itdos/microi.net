// Match the identity returned by this login, including an existing fixture user
// whose display name is not literally "admin".
export function getLoginIdentityName(response) {
    const user = response?.Data?.CurrentUser || response?.Data?.User || response?.Data;
    const name = String(user?.Name || user?.Account || "").trim();
    if (!name) throw new Error("Login response is missing the current user identity.");
    return name;
}
