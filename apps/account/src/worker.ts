import { hasTestAccess } from "./access-guard";
import { AuthService } from "./auth-service";
import { isTestMode, requireSecrets } from "./config";
import type { Env } from "./env";
import { AuthError } from "./errors";
import { allowedOrigin, bearerToken, errorResponse, json, preflight, readObject, stringField } from "./http";
import { NoopMailer, QqSmtpMailer } from "./mailer";
import { PairService } from "./pair-service";
import { PushService } from "./push-service";
import { AccountRepository } from "./repository";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);
    if (origin === null) return json({ error: "ORIGIN_NOT_ALLOWED", message: "请求来源不被允许。" }, 403);
    if (request.method === "OPTIONS") return origin ? preflight(origin) : new Response(null, { status: 204 });

    try {
      const url = new URL(request.url);
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true, service: "tongkan-account", testMode: isTestMode(env) }, 200, origin);
      }
      if (!hasTestAccess(request, env)) {
        return json({ error: "TEST_ACCESS_REQUIRED", message: "测试账号服务需要访问令牌。" }, 401, origin);
      }
      requireSecrets(env);
      const mailer = isTestMode(env) ? new NoopMailer() : new QqSmtpMailer(env);
      const repository = new AccountRepository(env.DB);
      const service = new AuthService(env, repository, mailer);
      const pairService = new PairService(env, repository);
      const pushService = new PushService(env, repository);
      if (url.pathname === "/api/auth/send-code" && request.method === "POST") {
        const body = await readObject(request);
        const result = await service.sendCode(
          stringField(body, "email") ?? "",
          request.headers.get("cf-connecting-ip"),
        );
        return json({ ok: true, ...result }, 202, origin);
      }
      if (url.pathname === "/api/auth/verify-code" && request.method === "POST") {
        const body = await readObject(request);
        const result = await service.verifyCode(
          stringField(body, "email") ?? "",
          stringField(body, "code") ?? "",
          stringField(body, "deviceName", false),
        );
        return json(result, 200, origin);
      }
      if (url.pathname === "/api/auth/refresh" && request.method === "POST") {
        return json(await service.refresh(bearerToken(request)), 200, origin);
      }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        await service.logout(bearerToken(request));
        await repository.revokeAllDeviceTokens(authenticated.user.id, Date.now());
        const headers = new Headers();
        if (origin) headers.set("access-control-allow-origin", origin);
        return new Response(null, { status: 204, headers });
      }
      if (url.pathname === "/api/me" && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json({ user: service.publicUser(authenticated.user) }, 200, origin);
      }
      if (url.pathname === "/api/me" && request.method === "PATCH") {
        const body = await readObject(request);
        const user = await service.updateProfile(
          bearerToken(request),
          stringField(body, "nickname") ?? "",
        );
        return json({ user }, 200, origin);
      }
      if (url.pathname === "/api/pair/invites" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await pairService.createInvite(authenticated.user), 201, origin);
      }
      const acceptMatch = url.pathname.match(/^\/api\/pair\/invites\/([^/]+)\/accept$/);
      if (acceptMatch && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const code = decodeURIComponent(acceptMatch[1] ?? "");
        return json({ pair: await pairService.acceptInvite(authenticated.user, code) }, 200, origin);
      }
      if (url.pathname === '/api/pair/unbind' && request.method === 'POST') {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await pairService.unbind(
          authenticated.user,
          stringField(body, 'pairId') ?? '',
          stringField(body, 'retention') ?? '',
        ), 200, origin);
      }
      if (url.pathname === "/api/pair" && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await pairService.getPairState(authenticated.user), 200, origin);
      }
      const retentionMatch = url.pathname.match(/^\/api\/pair\/archives\/([^/]+)\/retention$/);
      if (retentionMatch && request.method === 'POST') {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await pairService.decideArchiveRetention(
          authenticated.user,
          decodeURIComponent(retentionMatch[1] ?? ''),
          stringField(body, 'retention') ?? '',
        ), 200, origin);
      }
      if (url.pathname === "/api/devices/register" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await pushService.registerDevice(
          authenticated.user,
          stringField(body, "provider") ?? "",
          stringField(body, "token") ?? "",
          stringField(body, "deviceName", false),
          stringField(body, "appVersion", false),
        ), 200, origin);
      }
      if (url.pathname === "/api/devices/unregister" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        await pushService.unregisterDevice(authenticated.user, stringField(body, "provider") ?? "", stringField(body, "token") ?? "");
        return json({ ok: true }, 200, origin);
      }
      if (url.pathname === "/api/pair/watch-invites" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        const expiresAtValue = body.expiresAt;
        if (expiresAtValue !== undefined && typeof expiresAtValue !== "number") throw new AuthError("INVALID_REQUEST", "邀请有效期无效。", 400);
        return json(await pushService.sendWatchInvite(
          authenticated.user,
          stringField(body, "url") ?? "",
          stringField(body, "title", false),
          expiresAtValue as number | undefined,
        ), 202, origin);
      }
      throw new AuthError("NOT_FOUND", "接口不存在。", 404);
    } catch (error) {
      return errorResponse(error, origin ?? undefined);
    }
  },
} satisfies ExportedHandler<Env>;
