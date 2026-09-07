export type FocusPhase = "link" | "trace" | "deep" | "null" | "lock";

export type AnomalyKind =
  | "frame-loss"
  | "memory-echo"
  | "signal-bleed"
  | "pixel-drop";

export type ImmersiveEvent = "broadcast" | "milestone" | AnomalyKind;

export type Milestone = {
  seconds: number;
  previewSeconds: number;
  phase: Exclude<FocusPhase, "link">;
  code: string;
  message: string;
};

export const MILESTONES: Milestone[] = [
  { seconds: 600, previewSeconds: 10, phase: "trace", code: "TRACE", message: "ATTENTION LINK STABLE" },
  { seconds: 1500, previewSeconds: 25, phase: "deep", code: "DEEP", message: "EXTERNAL SIGNALS FADING" },
  { seconds: 2700, previewSeconds: 45, phase: "null", code: "NULL", message: "ONLY TASK AND BREATH REMAIN" },
  { seconds: 4500, previewSeconds: 75, phase: "lock", code: "LOCK", message: "CONNECTION LOCKED. KEEP MOVING." },
];

export const BROADCASTS = [
  "ATTENTION SIGNAL ACQUIRED.",
  "EXTERNAL NOISE IS LOSING ACCESS.",
  "MAINTAIN CURRENT INPUT.",
  "TASK CHANNEL STABLE.",
  "IGNORE IRRELEVANT SIGNALS.",
  "COGNITIVE LOAD: CONTROLLED.",
  "CONTINUE. DO NOT EXPLAIN.",
  "DO NOT FADE OUT.",
  "UNREGISTERED CHANNEL: SOMEONE ARRIVED BEFORE YOU.",
  "ARCHIVE CORRUPTED: YOU HAVE COMPLETED THIS BEFORE.",
];

export const ANOMALIES: Array<{ kind: AnomalyKind; label: string }> = [
  { kind: "frame-loss", label: "FRAME LOSS" },
  { kind: "memory-echo", label: "MEMORY ECHO" },
  { kind: "signal-bleed", label: "SIGNAL BLEED" },
  { kind: "pixel-drop", label: "PIXEL DROP" },
];

export const EXPERIENCE_TIMING = {
  firstBroadcastMs: 8000,
  broadcastMinMs: 18000,
  broadcastMaxMs: 32000,
  broadcastVisibleMs: 3200,
  anomalyMinMs: 240000,
  anomalyMaxMs: 420000,
  deepAnomalyMinMs: 4500,
  deepAnomalyMaxMs: 8500,
  anomalyVisibleMs: 1800,
  milestoneVisibleMs: 2600,
  preview: {
    firstBroadcastMs: 3000,
    broadcastMinMs: 4000,
    broadcastMaxMs: 7000,
    anomalyMinMs: 12000,
    anomalyMaxMs: 18000,
    deepAnomalyMinMs: 3000,
    deepAnomalyMaxMs: 5000,
  },
} as const;

export function getPhase(elapsedSeconds: number, previewMode = false): FocusPhase {
  let phase: FocusPhase = "link";
  for (const milestone of MILESTONES) {
    const threshold = previewMode ? milestone.previewSeconds : milestone.seconds;
    if (elapsedSeconds >= threshold) phase = milestone.phase;
  }
  return phase;
}

export function getMilestoneThreshold(milestone: Milestone, previewMode = false) {
  return previewMode ? milestone.previewSeconds : milestone.seconds;
}

export function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.round(Math.random() * (maximum - minimum));
}

export function shuffled<T>(items: readonly T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
