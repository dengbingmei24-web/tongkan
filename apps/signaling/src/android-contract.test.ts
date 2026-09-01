import { describe, expect, it } from "vitest";
import androidAuth from "../../../qa/protocol-contract/android-auth.json";
import androidPlaybackCommand from "../../../qa/protocol-contract/android-playback-command.json";
import androidPlaybackReport from "../../../qa/protocol-contract/android-playback-report.json";
import { parseClientMessage } from "./message-validation";

describe("Android shared protocol fixtures", () => {
  for (const [name, fixture] of [
    ["auth", androidAuth],
    ["playback command", androidPlaybackCommand],
    ["playback report", androidPlaybackReport],
  ] as const) {
    it(`accepts the Android ${name} fixture`, () => {
      expect(parseClientMessage(JSON.stringify(fixture))).toEqual({ ok: true, message: fixture });
    });
  }

  it("accepts the Alpha 10.4 Android playback report extension", () => {
    const fixture = {
      ...androidPlaybackReport,
      report: {
        ...androidPlaybackReport.report,
        ended: false,
        durationSeconds: 1_320,
      },
    };
    expect(parseClientMessage(JSON.stringify(fixture))).toEqual({ ok: true, message: fixture });
  });
});
