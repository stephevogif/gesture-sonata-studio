import { useCallback, useEffect, useRef, useState } from "react";
import {
  HandLandmarkProvider,
  cameraErrorFrom,
  openCamera,
  type CameraHandle,
} from "@/core/tracking/provider";
import type { TrackingFrame } from "@/core/tracking/types";

export type { TrackingFrame };

/**
 * React adapter over the hand landmark provider.
 * The detection loop runs on requestAnimationFrame and never triggers a React
 * render: frames are handed to the caller through a callback.
 */
export function useHandTracking(onFrame: (frame: TrackingFrame) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const providerRef = useRef<HandLandmarkProvider | null>(null);
  const cameraRef = useRef<CameraHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const runningRef = useRef(false);
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;
  const lastTimestamp = useRef(0);
  const fpsRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const usingVfcRef = useRef(false);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const provider = providerRef.current;
    if (!video || !provider) return;

    const now = performance.now();
    if (lastTimestamp.current) {
      const instant = 1000 / Math.max(1, now - lastTimestamp.current);
      fpsRef.current += (instant - fpsRef.current) * 0.1;
    }
    lastTimestamp.current = now;

    const hands = provider.detect(video, now);
    callbackRef.current({ hands, video, fps: fpsRef.current, timestamp: now });
    // ogni frame viene analizzato appena la camera lo consegna: meno ritardo
    // e nessuna detection ripetuta sullo stesso frame
    const vfc = (video as any).requestVideoFrameCallback?.bind(video);
    if (vfc) {
      usingVfcRef.current = true;
      rafRef.current = vfc(() => loop());
    } else {
      usingVfcRef.current = false;
      rafRef.current = requestAnimationFrame(loop);
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      const video = videoRef.current as any;
      if (usingVfcRef.current && video?.cancelVideoFrameCallback)
        video.cancelVideoFrameCallback(rafRef.current);
      else cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = null;
    cameraRef.current?.stop();
    cameraRef.current = null;
    runningRef.current = false;
    setRunning(false);
    setStatus("");
  }, []);

  const start = useCallback(async () => {
    // un solo avvio alla volta: il doppio tap su mobile non apre due camere
    if (startingRef.current || runningRef.current) return runningRef.current;
    startingRef.current = true;
    setError("");
    try {
      setStatus("Attivazione fotocamera…");
      const video = videoRef.current!;
      cameraRef.current = await openCamera(video);

      if (!providerRef.current) providerRef.current = new HandLandmarkProvider();
      if (!providerRef.current.ready) {
        setStatus("Caricamento tracciamento…");
        await providerRef.current.load();
      }

      setStatus("");
      runningRef.current = true;
      setRunning(true);
      rafRef.current = requestAnimationFrame(loop);
      return true;
    } catch (raw) {
      const err = cameraErrorFrom(raw);
      console.error(err);
      // rilascia sempre la camera: un retry non deve trovare il device occupato
      cameraRef.current?.stop();
      cameraRef.current = null;
      runningRef.current = false;
      setStatus("");
      setError(err.message);
      setRunning(false);
      return false;
    } finally {
      startingRef.current = false;
    }
  }, [loop]);

  useEffect(() => () => stop(), [stop]);

  // in background la camera viene rilasciata: niente stream appesi al ritorno
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden" && runningRef.current) stop();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [stop]);

  return { videoRef, running, status, error, start, stop };
}
