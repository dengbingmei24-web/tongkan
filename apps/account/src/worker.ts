import { hasTestAccess } from "./access-guard";
import { ActiveRoomService } from "./active-room-service";
import { AuthService } from "./auth-service";
import { D1CalendarRepository } from "./calendar-repository";
import { CalendarService } from "./calendar-service";
import { isTestMode, requireSecrets } from "./config";
import type { Env } from "./env";
import { AuthError } from "./errors";
import { allowedOrigin, bearerToken, errorResponse, json, preflight, readObject, stringField } from "./http";
import { D1LibraryRepository } from "./library-repository";
import { LibraryService } from "./library-service";
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
      const activeRoomService = new ActiveRoomService(env, repository);
      const pushService = new PushService(env, repository);
      const libraryService = new LibraryService(new D1LibraryRepository(env.DB));
      const calendarService = new CalendarService(new D1CalendarRepository(env.DB));
      if (url.pathname === "/api/auth/send-code" && request.method === "POST") {
        const body = await readObject(request);
        const result = await service.sendCode(stringField(body, "email") ?? "", request.headers.get("cf-connecting-ip"));
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
        const user = await service.updateProfile(bearerToken(request), stringField(body, "nickname") ?? "");
        return json({ user }, 200, origin);
      }
      if (url.pathname === "/api/pair/invites" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await pairService.createInvite(authenticated.user), 201, origin);
      }
      const acceptMatch = url.pathname.match(/^\/api\/pair\/invites\/([^/]+)\/accept$/);
      if (acceptMatch && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json({ pair: await pairService.acceptInvite(authenticated.user, decodeURIComponent(acceptMatch[1] ?? "")) }, 200, origin);
      }
      if (url.pathname === "/api/pair/unbind" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await pairService.unbind(
          authenticated.user,
          stringField(body, "pairId") ?? "",
          stringField(body, "retention") ?? "",
        ), 200, origin);
      }
      if (url.pathname === "/api/pair" && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await pairService.getPairState(authenticated.user), 200, origin);
      }
      if (url.pathname === "/api/pair/active-room" && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await activeRoomService.get(authenticated.user), 200, origin);
      }
      if (url.pathname === "/api/pair/active-room" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        const expiresAtValue = body.expiresAt;
        if (expiresAtValue !== undefined && typeof expiresAtValue !== "number") invalidRequest("房间展示有效期无效。");
        return json(await activeRoomService.publish(
          authenticated.user,
          stringField(body, "url") ?? "",
          expiresAtValue as number | undefined,
        ), 201, origin);
      }
      if (url.pathname === "/api/pair/active-room" && request.method === "DELETE") {
        const authenticated = await service.authenticate(bearerToken(request));
        await activeRoomService.clear(authenticated.user);
        return json({ ok: true }, 200, origin);
      }
      const archiveLibraryMatch = url.pathname.match(/^\/api\/pair\/archives\/([^/]+)\/library$/);
      if (archiveLibraryMatch && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await libraryService.getArchiveLibrary(authenticated.user, decodeURIComponent(archiveLibraryMatch[1] ?? "")), 200, origin);
      }
      const retentionMatch = url.pathname.match(/^\/api\/pair\/archives\/([^/]+)\/retention$/);
      if (retentionMatch && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await pairService.decideArchiveRetention(
          authenticated.user,
          decodeURIComponent(retentionMatch[1] ?? ""),
          stringField(body, "retention") ?? "",
        ), 200, origin);
      }
      if (url.pathname === "/api/library" && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        const query = optionalQuery(url, "query", 80);
        const status = url.searchParams.get("status") ?? "all";
        if (!["all", "unwatched", "watched"].includes(status)) invalidRequest("筛选状态无效。");
        const categoryId = url.searchParams.get("categoryId") ?? undefined;
        if (categoryId !== undefined) requireId(categoryId);
        const filters = { status: status as "all" | "unwatched" | "watched" } as {
          query?: string;
          status: "all" | "unwatched" | "watched";
          categoryId?: string;
        };
        if (query !== undefined) filters.query = query;
        if (categoryId !== undefined) filters.categoryId = categoryId;
        return json(await libraryService.getActiveLibrary(authenticated.user, filters), 200, origin);
      }
      if (url.pathname === "/api/library/categories" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await libraryService.createCategory(
          authenticated.user,
          stringField(body, "name") ?? "",
          integerField(body, "expectedRevision"),
        ), 201, origin);
      }
      if (url.pathname === "/api/library/categories/reorder" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await libraryService.reorderCategories(
          authenticated.user,
          stringArrayField(body, "orderedCategoryIds", 100),
          integerField(body, "expectedRevision"),
        ), 200, origin);
      }
      const categoryMatch = url.pathname.match(/^\/api\/library\/categories\/([^/]+)$/);
      if (categoryMatch && request.method === "PATCH") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await libraryService.renameCategory(
          authenticated.user,
          decodeURIComponent(categoryMatch[1] ?? ""),
          stringField(body, "name") ?? "",
          integerField(body, "expectedRevision"),
        ), 200, origin);
      }
      if (categoryMatch && request.method === "DELETE") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await libraryService.deleteCategory(
          authenticated.user,
          decodeURIComponent(categoryMatch[1] ?? ""),
          integerQuery(url, "expectedRevision"),
        ), 200, origin);
      }
      if (url.pathname === "/api/library/items/batch" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await libraryService.addBatch(
          authenticated.user,
          stringArrayField(body, "inputs", 20, 1, 2000),
          nullableIdField(body, "categoryId"),
          integerField(body, "expectedRevision"),
        ), 200, origin);
      }
      if (url.pathname === "/api/library/items/reorder" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await libraryService.reorderItems(
          authenticated.user,
          stringArrayField(body, "orderedItemIds", 1000),
          integerField(body, "expectedRevision"),
        ), 200, origin);
      }
      const itemMatch = url.pathname.match(/^\/api\/library\/items\/([^/]+)$/);
      if (itemMatch && request.method === "PATCH") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        const categoryProvided = Object.prototype.hasOwnProperty.call(body, "categoryId");
        const watchStatus = optionalWatchStatus(body);
        const refreshMetadata = optionalBooleanField(body, "refreshMetadata");
        const title = optionalStringField(body, "title", 160);
        if (!categoryProvided && watchStatus === undefined && refreshMetadata === undefined && title === undefined) invalidRequest("没有可更新的字段。");
        const patch: {
          categoryProvided: boolean;
          categoryId?: string | null;
          watchStatus?: "unwatched" | "watched";
          refreshMetadata?: boolean;
          title?: string;
        } = { categoryProvided };
        if (categoryProvided) patch.categoryId = nullableIdField(body, "categoryId");
        if (watchStatus !== undefined) patch.watchStatus = watchStatus;
        if (refreshMetadata !== undefined) patch.refreshMetadata = refreshMetadata;
        if (title !== undefined) patch.title = title;
        return json(await libraryService.updateItem(
          authenticated.user,
          decodeURIComponent(itemMatch[1] ?? ""),
          patch,
          integerField(body, "expectedRevision"),
        ), 200, origin);
      }
      if (itemMatch && request.method === "DELETE") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await libraryService.deleteItem(
          authenticated.user,
          decodeURIComponent(itemMatch[1] ?? ""),
          integerQuery(url, "expectedRevision"),
        ), 200, origin);
      }
      const archiveCalendarMatch = url.pathname.match(/^\/api\/pair\/archives\/([^/]+)\/calendar$/);
      if (archiveCalendarMatch && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await calendarService.getArchiveMonth(
          authenticated.user,
          decodeURIComponent(archiveCalendarMatch[1] ?? ""),
          requiredQuery(url, "month"),
        ), 200, origin);
      }
      if (url.pathname === "/api/calendar" && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        const month = url.searchParams.get("month");
        const date = url.searchParams.get("date");
        if ((month === null) === (date === null)) invalidRequest("请提供 month 或 date，且只能提供一个。");
        return json(month !== null
          ? await calendarService.getActiveMonth(authenticated.user, month)
          : await calendarService.getActiveDate(authenticated.user, date ?? ""), 200, origin);
      }
      if (url.pathname === "/api/calendar/today" && request.method === "GET") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await calendarService.getToday(authenticated.user, requiredQuery(url, "date")), 200, origin);
      }
      if (url.pathname === "/api/calendar/plans" && request.method === "POST") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        return json(await calendarService.createPlan(
          authenticated.user,
          stringField(body, "libraryItemId") ?? "",
          stringField(body, "date") ?? "",
          optionalNullableStartTimeField(body, "startTime"),
          optionalNullableStringField(body, "note", 200),
          integerField(body, "expectedRevision"),
        ), 201, origin);
      }
      const calendarPlanMatch = url.pathname.match(/^\/api\/calendar\/plans\/([^/]+)$/);
      if (calendarPlanMatch && request.method === "PATCH") {
        const authenticated = await service.authenticate(bearerToken(request));
        const body = await readObject(request);
        const patch: { date?: string; startTime?: string | null; note?: string | null; status?: "planned" | "completed" } = {};
        if (Object.prototype.hasOwnProperty.call(body, "date")) patch.date = stringField(body, "date") ?? "";
        if (Object.prototype.hasOwnProperty.call(body, "startTime")) patch.startTime = optionalNullableStartTimeField(body, "startTime") ?? null;
        if (Object.prototype.hasOwnProperty.call(body, "note")) patch.note = optionalNullableStringField(body, "note", 200) ?? null;
        if (Object.prototype.hasOwnProperty.call(body, "status")) patch.status = calendarStatusField(body);
        return json(await calendarService.updatePlan(
          authenticated.user,
          decodeURIComponent(calendarPlanMatch[1] ?? ""),
          patch,
          integerField(body, "expectedRevision"),
        ), 200, origin);
      }
      if (calendarPlanMatch && request.method === "DELETE") {
        const authenticated = await service.authenticate(bearerToken(request));
        return json(await calendarService.deletePlan(
          authenticated.user,
          decodeURIComponent(calendarPlanMatch[1] ?? ""),
          integerQuery(url, "expectedRevision"),
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
        if (expiresAtValue !== undefined && typeof expiresAtValue !== "number") invalidRequest("邀请有效期无效。");
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

function integerField(body: Record<string, unknown>, name: string): number {
  const value = body[name];
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalidRequest("请求版本无效。");
  return value as number;
}

function integerQuery(url: URL, name: string): number {
  const value = url.searchParams.get(name);
  if (value === null || !/^\d+$/.test(value)) invalidRequest("请求版本无效。");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) invalidRequest("请求版本无效。");
  return parsed;
}

function stringArrayField(body: Record<string, unknown>, name: string, maxItems: number, minLength = 0, maxLength = 2000): string[] {
  const value = body[name];
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string" || item.length < minLength || item.length > maxLength)) {
    invalidRequest("请求列表无效。");
  }
  return value as string[];
}

function nullableIdField(body: Record<string, unknown>, name: string): string | null {
  const value = body[name];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalidRequest("资源 ID 无效。");
  requireId(value as string);
  return value as string;
}

function optionalNullableStringField(body: Record<string, unknown>, name: string, maxLength: number): string | null | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") invalidRequest("文本字段无效。");
  const normalized = value.trim();
  if (!normalized) return null;
  if (Array.from(normalized).length > maxLength) invalidRequest("文本字段过长。");
  return normalized;
}

function optionalNullableStartTimeField(body: Record<string, unknown>, name: string): string | null | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") invalidRequest("开始时间格式应为 HH:mm。");
  const normalized = value.trim();
  if (!normalized) invalidRequest("开始时间格式应为 HH:mm。");
  return normalized;
}

function calendarStatusField(body: Record<string, unknown>): "planned" | "completed" {
  const value = body.status;
  if (value !== "planned" && value !== "completed") invalidRequest("计划状态无效。");
  return value;
}

function requiredQuery(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (value === null || value === "") invalidRequest("请求参数不完整。");
  return value;
}
function optionalBooleanField(body: Record<string, unknown>, name: string): boolean | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") invalidRequest("布尔字段无效。");
  return value as boolean;
}

function optionalStringField(body: Record<string, unknown>, name: string, maxLength: number): string | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || Array.from(value.trim()).length > maxLength) {
    invalidRequest("文本字段无效。");
  }
  return value.trim();
}

function optionalWatchStatus(body: Record<string, unknown>): "unwatched" | "watched" | undefined {
  const value = body.watchStatus;
  if (value === undefined) return undefined;
  if (value !== "unwatched" && value !== "watched") invalidRequest("观看状态无效。");
  return value;
}

function optionalQuery(url: URL, name: string, maxLength: number): string | undefined {
  const value = url.searchParams.get(name) ?? undefined;
  if (value !== undefined && value.length > maxLength) invalidRequest("搜索内容过长。");
  return value;
}

function requireId(value: string): void {
  if (!/^[a-f0-9]{32}$/.test(value)) invalidRequest("资源 ID 无效。");
}

function invalidRequest(message: string): never {
  throw new AuthError("INVALID_REQUEST", message, 400);
}
