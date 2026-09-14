export function siteLoginRedirect(search, origin) {
  const fallback = '/profile.html#/overview';
  const input = new URLSearchParams(search).get('redirect');
  if (!input || /[\\\u0000-\u001f]/.test(input)) return fallback;
  try {
    const target = new URL(input.startsWith('/') ? input : '/' + input, origin);
    if (target.origin !== origin || /\/(?:login)(?:\.html)?\/?$/i.test(target.pathname)) return fallback;
    if (target.pathname === '/profile.html' && !target.hash) target.hash = '/overview';
    return target.pathname + target.search + target.hash;
  } catch { return fallback; }
}
