'use client';
// Camera hand control for the 3D universe. Runs MediaPipe hand tracking in the browser; video never leaves the device.
// Draws the tracked hand and a cursor over the universe and turns gestures into scene actions.
import {useEffect, useRef} from 'react';
import {GestureTracker, type GestureEvent, type HandFrame, type Point} from '@/lib/hand-gesture';

export type HandStatus = 'off' | 'loading' | 'on' | 'error';
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
// The hand rarely reaches the edge of the camera frame, so the middle of the frame covers the whole screen.
const fit = (v: number) => Math.min(1, Math.max(0, (v - 0.12) / 0.76));
export const toScreen = (p: Point): Point => ({x: fit(p.x), y: fit(p.y)});

type Landmarker = {detectForVideo: (video: HTMLVideoElement, time: number) => {landmarks: Point[][]}; close: () => void};

async function loadLandmarker(): Promise<Landmarker> {
  const {FilesetResolver, HandLandmarker} = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: {modelAssetPath: '/mediapipe/hand_landmarker.task', delegate},
    runningMode: 'VIDEO' as const, numHands: 1,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
  });
  try { return await HandLandmarker.createFromOptions(files, options('GPU')); }
  catch { return await HandLandmarker.createFromOptions(files, options('CPU')); }
}

function draw(canvas: HTMLCanvasElement, frame: HandFrame | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!frame) return;
  const at = (p: Point) => { const s = toScreen(p); return [s.x * w, s.y * h] as const; };
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(150,200,255,.5)'; ctx.shadowColor = 'rgba(120,180,255,.9)'; ctx.shadowBlur = 8;
  ctx.beginPath();
  for (const [a, b] of BONES) { const [x1, y1] = at(frame.points[a]), [x2, y2] = at(frame.points[b]); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(210,230,255,.85)';
  for (const p of frame.points) { const [x, y] = at(p); ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  const [cx, cy] = [toScreen(frame.cursor).x * w, toScreen(frame.cursor).y * h];
  ctx.shadowBlur = frame.pinching ? 22 : 12;
  ctx.shadowColor = frame.pinching ? 'rgba(255,214,140,1)' : 'rgba(140,190,255,1)';
  ctx.strokeStyle = frame.pinching ? 'rgba(255,224,170,.95)' : 'rgba(190,220,255,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, frame.pinching ? 9 : 20, 0, Math.PI * 2); ctx.stroke();
  if (frame.pinching) { ctx.fillStyle = 'rgba(255,230,180,.55)'; ctx.fill(); }
}

export default function HandControl({active, onEvents, onStatus}: {
  active: boolean;
  onEvents: (events: GestureEvent[]) => void;
  onStatus: (status: HandStatus) => void;
}) {
  const video = useRef<HTMLVideoElement>(null), overlay = useRef<HTMLCanvasElement>(null);
  const handlers = useRef({onEvents, onStatus});
  handlers.current = {onEvents, onStatus};

  useEffect(() => {
    if (!active) return;
    let alive = true, frameId = 0, lastTime = -1;
    let stream: MediaStream | null = null, landmarker: Landmarker | null = null;
    const tracker = new GestureTracker();
    handlers.current.onStatus('loading');
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}}, audio: false});
        const v = video.current;
        if (!alive || !v) return;
        v.srcObject = stream;
        await v.play();
        landmarker = await loadLandmarker();
        if (!alive) return;
        handlers.current.onStatus('on');
        const loop = () => {
          if (!alive) return;
          frameId = requestAnimationFrame(loop);
          if (!v.videoWidth || v.currentTime === lastTime) return;
          lastTime = v.currentTime;
          const now = performance.now();
          const result = landmarker!.detectForVideo(v, now);
          const {frame, events} = tracker.update(result.landmarks[0] ?? null, now);
          if (overlay.current) draw(overlay.current, frame);
          if (events.length) handlers.current.onEvents(events);
        };
        loop();
      } catch {
        if (alive) handlers.current.onStatus('error');
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach(t => t.stop());
      landmarker?.close();
      if (overlay.current) draw(overlay.current, null);
      handlers.current.onEvents([{type: 'lost'}]);
      handlers.current.onStatus('off');
    };
  }, [active]);

  return <>
    <video ref={video} className="uv-hand-video" playsInline muted aria-hidden="true"/>
    <canvas ref={overlay} className="uv-hand" aria-hidden="true"/>
  </>;
}
