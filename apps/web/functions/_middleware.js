export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === "/account-api" || url.pathname.startsWith("/account-api/")) {
    const accountUrl = new URL(context.request.url);
    accountUrl.pathname = url.pathname.slice("/account-api".length) || "/";
    return context.env.ACCOUNT.fetch(new Request(accountUrl, context.request));
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/rooms/")) {
    return context.env.SIGNALING.fetch(context.request);
  }
  return context.next();
}
