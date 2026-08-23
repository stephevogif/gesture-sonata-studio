import { useCallback, useEffect, useRef, useState } from "react";
import { handOpenness, handTilt, readFingers, type HandFrame, type Point } from "@/lib/gestures";

export type TrackingFrame = {
  hands: HandFrame[];
  video: HTMLVideoElement;
  fps: number;
};

/**
 * Webcam + MediaPipe Hand Landmarker.
 * Il loop gira su requestAnimationFrame e NON causa render React:
 * i dati arrivano al chiamante tramite callback.
 */
export function useHandTracking(onFrame: (f: TrackingFrame) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const cbRef = useRef(onFrame);
  cbRef.current = onFrame;
  const lastTs = useRef(0);
  const fpsRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  const loop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    let result: any = null;
    try {
      result = landmarker.detectForVideo(video, performance.now());
    } catch {
      /* frame non pronto */
    }

    const now = performance.now();
    if (lastTs.current) {
      const inst = 1000 / Math.max(1, now - lastTs.current);
      fpsRef.current += (inst - fpsRef.current) * 0.1;
    }
    lastTs.current = now;

    const lmList: Point[][] = result?.landmarks ?? [];
    const handed: any[] = result?.handedness ?? result?.handednesses ?? [];
    const hands: HandFrame[] = lmList.map((lm, i) => {
      const cat = handed[i]?.[0];
      // la webcam frontale è specchiata: la mano etichettata "Left" dal modello
      // è la mano DESTRA fisica dell'utente.
      const handedness = cat?.categoryName === "Left" ? "right" : "left";
      const { fingers, count } = readFingers(lm);
      const wrist = lm[0]!;
      const mid = lm[9]!;
      const y = (wrist.y + mid.y) / 2;
      return {
        handedness,
        fingers,
        count,
        x: 1 - (wrist.x + mid.x) / 2,
        y,
        height: 1 - y,
        tilt: handTilt(lm),
        openness: handOpenness(lm),
        confidence: cat?.score ?? 1,
        landmarks: lm,
      };
    });

    cbRef.current({ hands, video, fps: fpsRef.current });
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    try {
      setStatus("Attivazione fotocamera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      if (!landmarkerRef.current) {
        setStatus("Caricamento tracciamento…");
        const vision = await import("@mediapipe/tasks-vision");
        const files = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        landmarkerRef.current = await vision.HandLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      setStatus("");
      setRunning(true);
      rafRef.current = requestAnimationFrame(loop);
      return true;
    } catch (e) {
      console.error(e);
      setStatus("Impossibile accedere alla fotocamera.");
      setRunning(false);
      return false;
    }
  }, [loop]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setRunning(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, running, status, start, stop };
}
