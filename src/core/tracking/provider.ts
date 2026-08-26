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

export type CameraErrorCode =
  | "denied"
  | "busy"
  | "notfound"
  | "unsupported"
  | "model"
  | "unknown";

export class CameraError extends Error {
  readonly code: CameraErrorCode;
  constructor(code: CameraErrorCode, message: string) {
    super(message);
    this.name = "CameraError";
    this.code = code;
  }
}

const MESSAGES: Record<CameraErrorCode, string> = {
  denied:
    "Permesso fotocamera negato. Attivalo dall'icona nella barra degli indirizzi, poi riprova.",
  busy: "La fotocamera è usata da un'altra app o scheda. Chiudila e riprova.",
  notfound: "Nessuna fotocamera trovata su questo dispositivo.",
  unsupported: "Questo browser non permette l'accesso alla fotocamera (serve HTTPS).",
  model: "Caricamento del tracciamento non riuscito. Controlla la rete e riprova.",
  unknown: "Avvio non riuscito. Riprova.",
};

export function cameraErrorFrom(error: unknown): CameraError {
  if (error instanceof CameraError) return error;
  const name = (error as { name?: string } | null)?.name ?? "";
  let code: CameraErrorCode = "unknown";
  if (name === "NotAllowedError" || name === "SecurityError") code = "denied";
  else if (name === "NotReadableError" || name === "AbortError") code = "busy";
  else if (name === "NotFoundError" || name === "DevicesNotFoundError") code = "notfound";
  else if (name === "OverconstrainedError") code = "busy";
  return new CameraError(code, MESSAGES[code]);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const IDEAL: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 480 },
    height: { ideal: 360 },
    frameRate: { ideal: 60 },
  },
  audio: false,
};
const SIMPLE: MediaStreamConstraints = { video: true, audio: false };

async function requestStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("unsupported", MESSAGES.unsupported);
  }
  try {
    return await navigator.mediaDevices.getUserMedia(IDEAL);
  } catch (first) {
    const err = cameraErrorFrom(first);
    if (err.code === "denied" || err.code === "notfound") throw err;
    try {
      return await navigator.mediaDevices.getUserMedia(SIMPLE);
    } catch (second) {
      // il dispositivo può essere occupato per un istante: un solo nuovo tentativo
      await sleep(350);
      try {
        return await navigator.mediaDevices.getUserMedia(SIMPLE);
      } catch {
        throw cameraErrorFrom(second);
      }
    }
  }
}

/**
 * Opens the user-facing camera and binds it to `video`.
 * Any failure after the stream is granted releases the device immediately, so a
 * retry never hits a camera left busy by a half-finished start.
 */
export async function openCamera(video: HTMLVideoElement): Promise<CameraHandle> {
  const stream = await requestStream();
  const release = () => {
    stream.getTracks().forEach((track) => track.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
  try {
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    try {
      await video.play();
    } catch (playError) {
      // play() interrotto da un re-render non è fatale finché il video scorre
      if ((playError as { name?: string })?.name !== "AbortError") throw playError;
    }
    return { video, stop: release };
  } catch (error) {
    release();
    throw cameraErrorFrom(error);
  }
}

const WASM_BUNDLE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** Loads the MediaPipe hand landmarker; throws a typed CameraError on failure. */
export async function loadHandLandmarker(numHands = 2): Promise<any> {
  try {
    const vision = await import("@mediapipe/tasks-vision");
    const files = await vision.FilesetResolver.forVisionTasks(WASM_BUNDLE);
    return await vision.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  } catch {
    throw new CameraError("model", MESSAGES.model);
  }
}


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
    this.detector = (await loadHandLandmarker(this.maxHands)) as unknown as RawDetector;

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
