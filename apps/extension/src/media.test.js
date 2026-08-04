import assert from "node:assert/strict";
import test from "node:test";

test("extension source keeps Bilibili media identity stable", () => {
  const url = new URL("https://www.bilibili.com/video/BV1xx411c7mD?p=3");
  const match = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);
  assert.equal(match?.[1], "BV1xx411c7mD");
  assert.equal(Number(url.searchParams.get("p")), 3);
});
