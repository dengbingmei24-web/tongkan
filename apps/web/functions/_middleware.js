export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/rooms/")) {
    return context.env.SIGNALING.fetch(context.request);
  }
  return context.next();
}
