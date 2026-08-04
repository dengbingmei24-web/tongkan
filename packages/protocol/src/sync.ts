import type { PlaybackAnchor } from "./types";

export interface DriftCorrection {
  kind: "none" | "rate" | "seek";
  targetPositionSeconds: number;
  playbackRate: number;
  driftSeconds: number;
}

export function positionAt(anchor: PlaybackAnchor, serverNowMs: number): number {
  if (anchor.paused) return Math.max(0, anchor.positionSeconds);
  const elapsedSeconds = Math.max(0, serverNowMs - anchor.anchoredAtServerMs) / 1000;
  return Math.max(0, anchor.positionSeconds + elapsedSeconds * anchor.playbackRate);
}

export function planDriftCorrection(
  anchor: PlaybackAnchor,
  localPositionSeconds: number,
  serverNowMs: number,
): DriftCorrection {
  const targetPositionSeconds = positionAt(anchor, serverNowMs);
  const driftSeconds = targetPositionSeconds - localPositionSeconds;
  const absoluteDrift = Math.abs(driftSeconds);

  if (absoluteDrift < 0.3) {
    return {
      kind: "none",
      targetPositionSeconds,
      playbackRate: anchor.playbackRate,
      driftSeconds,
    };
  }

  if (absoluteDrift <= 1.5) {
    const correction = Math.min(0.05, absoluteDrift * 0.04);
    return {
      kind: "rate",
      targetPositionSeconds,
      playbackRate: driftSeconds > 0
        ? anchor.playbackRate + correction
        : Math.max(0.25, anchor.playbackRate - correction),
      driftSeconds,
    };
  }

  return {
    kind: "seek",
    targetPositionSeconds,
    playbackRate: anchor.playbackRate,
    driftSeconds,
  };
}
