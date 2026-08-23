/**
 * Heaven Synth — hand landmark provider.
 * Layer: Camera Input + Hand Landmark Provider.
 *
 * This is the only module in the app that knows which landmark library is in
 * use (currently MediaPipe Tasks Vision, Apache-2.0). Everything above the
 * provider consumes `TrackedHand` values and stays library agnostic.
 */

import { FingerAnalyzer, palmCentre, palmOpenness, palmTilt } from "./fingers";
import type { Handedness, Landmark, TrackedHand } from "./types";

export type ProviderOptions = {
  maxHands?: number;
  /** the front camera is mirrored on screen; flip the x axis to match */
  mirrored?: boolean;
};

export type CameraHandle = {
  video: HTMLVideoElement;
  stop: () => void;
};

/** Opens the user-facing camera and binds it to `video`. */
export async function openCamera(video: HTMLVideoElement): Promise<CameraHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play();
  return {
    video,
    stop: () => {
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}

const WASM_BUNDLE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type RawDetector = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => unknown;
  close?: () => void;
};

/** Turns a stream of video frames into `TrackedHand[]`. */
export class HandLandmarkProvider {
  private detector: RawDetector | null = null;
  private analyzers = new Map<string, FingerAnalyzer>();
  private readonly maxHands: number;
  private readonly mirrored: boolean;

  constructor(options: ProviderOptions = {}) {
    this.maxHands = options.maxHands ?? 2;
    this.mirrored = options.mirrored ?? true;
  }

  get ready() {
    return this.detector !== null;
  }

  /** Loads the detector lazily; safe to call more than once. */
  async load(): Promise<void> {
    if (this.detector) return;
    const vision = await import("@mediapipe/tasks-vision");
    const files = await vision.FilesetResolver.forVisionTasks(WASM_BUNDLE);
    this.detector = (await vision.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: this.maxHands,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })) as unknown as RawDetector;
  }

  /** Detects the hands visible in the current video frame. */
  detect(video: HTMLVideoElement, timestamp = performance.now()): TrackedHand[] {
    if (!this.detector) return [];
    let result: any;
    try {
      result = this.detector.detectForVideo(video, timestamp);
    } catch {
      return []; // frame not decoded yet
    }
    const clouds: Landmark[][] = result?.landmarks ?? [];
    const labels: any[] = result?.handedness ?? result?.handednesses ?? [];

    return clouds.map((landmarks, index) => {
      const category = labels[index]?.[0];
      // the preview is mirrored, so the model's "Left" is the user's right hand
      const handedness: Handedness =
        this.mirrored === (category?.categoryName === "Left") ? "right" : "left";
      const analyzer = this.analyzerFor(handedness, index);
      const { fingers, count } = analyzer.read(landmarks);
      const centre = palmCentre(landmarks);
      const x = this.mirrored ? 1 - centre.x : centre.x;
      return {
        handedness,
        landmarks,
        fingers,
        count,
        x,
        y: centre.y,
        height: 1 - centre.y,
        tilt: palmTilt(landmarks),
        openness: palmOpenness(landmarks),
        confidence: typeof category?.score === "number" ? category.score : 1,
        timestamp,
      } satisfies TrackedHand;
    });
  }

  private analyzerFor(handedness: Handedness, index: number) {
    const key = `${handedness}:${index}`;
    let analyzer = this.analyzers.get(key);
    if (!analyzer) {
      analyzer = new FingerAnalyzer();
      this.analyzers.set(key, analyzer);
    }
    return analyzer;
  }

  dispose() {
    this.detector?.close?.();
    this.detector = null;
    this.analyzers.clear();
  }
}
