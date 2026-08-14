import type { Env } from "./env";

export function hasTestAccess(request: Request, env: Env): boolean {
  const expected = env.TEST_ACCESS_TOKEN;
  if (!expected) return true;
  const actual = request.headers.get("x-tongkan-test-key") ?? "";
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}
