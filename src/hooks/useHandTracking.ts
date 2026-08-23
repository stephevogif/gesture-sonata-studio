import { useCallback, useEffect, useRef, useState } from "react";
import { HandLandmarkProvider, openCamera, type CameraHandle } from "@/core/tracking/provider";
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
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;
  const lastTimestamp = useRef(0);
  const fpsRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

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
    callbackRef.current({ hands, video, fps: fpsRef.current });
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
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
      setRunning(true);
      rafRef.current = requestAnimationFrame(loop);
      return true;
    } catch (error) {
      console.error(error);
      setStatus("Impossibile accedere alla fotocamera.");
      setRunning(false);
      return false;
    }
  }, [loop]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    cameraRef.current?.stop();
    cameraRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, running, status, start, stop };
}
