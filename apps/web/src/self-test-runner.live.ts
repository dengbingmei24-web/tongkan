import { afterAll, beforeAll, expect, it } from "vitest";
import { SelfTestRunner } from "./self-test-runner";

let runner: SelfTestRunner;

beforeAll(() => {
  Object.assign(globalThis, { window: globalThis });
  runner = new SelfTestRunner();
});

afterAll(() => runner.dispose());

it("通过七项真实双端验收", async () => {
  await runner.initialize();
  expect(runner.getState().phase).toBe("ready");

  await runner.runAll();
  const state = runner.getState();
  expect(state.scenarios.map((scenario) => scenario.status)).toEqual(Array(7).fill("passed"));

  const bridgeSequence = state.serviceSequence + 1;
  runner.applyExternalPlayback("guest", {
    kind: "rate",
    playbackRate: 1.5,
    ...(state.media ? { media: state.media } : {}),
  });
  await waitUntil(() => runner.getState().serviceSequence >= bridgeSequence);
  expect(runner.getState().authoritativeRate).toBe(1.5);
  expect(runner.getBridgePayload("guest")?.anchor.sequence).toBe(bridgeSequence);

  console.log("自测页运行器通过：");
  for (const scenario of state.scenarios) console.log(`  ✓ ${scenario.label}：${scenario.detail}`);
  console.log("  ✓ 真实 B站桥接事件可以进入访客席位并生成新权威序号");
}, 30_000);

function waitUntil(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  if (predicate()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error("等待桥接事件进入权威状态超时"));
      }
    }, 25);
  });
}
