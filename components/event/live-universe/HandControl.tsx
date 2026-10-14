'use client';
// Camera hand control for the 3D universe. MediaPipe reads the hand in the browser; video never leaves the device.
// Shows a mirrored webcam preview with the tracked hand, draws a cursor over the universe, and turns gestures into scene actions.
import {useEffect, useRef, useState} from 'react';
import {GestureTracker, type GestureEvent, type HandFrame, type Point} from '@/lib/hand-gesture';

type Status = {kind: 'camera' | 'loading' | 'waiting' | 'tracking' | 'error'; message?: string};
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
// The hand rarely reaches the edge of the camera frame, so the middle of the frame covers the whole screen.
const fit = (v: number) => Math.min(1, Math.max(0, (v - 0.12) / 0.76));
export const toScreen = (p: Point): Point => ({x: fit(p.x), y: fit(p.y)});

type Landmarker = {detectForVideo: (video: HTMLVideoElement, time: number) => {landmarks: Point[][]}; close: () => void};
type Delegate = 'GPU' | 'CPU';

async function loadLandmarker(delegate: Delegate): Promise<Landmarker> {
  const {FilesetResolver, HandLandmarker} = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  return HandLandmarker.createFromOptions(files, {
    baseOptions: {modelAssetPath: '/mediapipe/hand_landmarker.task', delegate},
    runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
}

function cameraError(error: unknown) {
  const name = (error as {name?: string})?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return '카메라 권한이 막혀 있어요. 주소창의 카메라 아이콘에서 허용한 뒤 다시 켜 주세요.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '카메라를 찾지 못했어요.';
  if (name === 'NotReadableError') return '다른 앱이 카메라를 쓰고 있어요. 줌이나 다른 탭을 닫고 다시 켜 주세요.';
  return '카메라를 켜지 못했어요. 다시 켜 주세요.';
}

function paint(canvas: HTMLCanvasElement | null, frame: HandFrame | null, map: (p: Point) => Point, cursor: boolean, flash = 0, target: Point | null = null) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!frame) return;
  const at = (p: Point) => { const s = map(p); return [s.x * w, s.y * h] as const; };
  ctx.lineWidth = cursor ? 1.2 : 2; ctx.strokeStyle = cursor ? 'rgba(150,200,255,.22)' : 'rgba(150,210,255,.95)';
  ctx.shadowColor = 'rgba(120,180,255,.9)'; ctx.shadowBlur = cursor ? 6 : 4;
  ctx.beginPath();
  for (const [a, b] of BONES) { const [x1, y1] = at(frame.points[a]), [x2, y2] = at(frame.points[b]); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  ctx.stroke();
  ctx.fillStyle = cursor ? 'rgba(210,230,255,.5)' : '#fff';
  for (const p of frame.points) { const [x, y] = at(p); ctx.beginPath(); ctx.arc(x, y, cursor ? 1.8 : 2.6, 0, Math.PI * 2); ctx.fill(); }
  const [cx, cy] = at(frame.cursor);
  if (target) { // what a pinch would hit right now
    ctx.save(); ctx.setLineDash([5, 5]); ctx.lineWidth = 1.6; ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,214,140,.9)';
    ctx.strokeStyle = 'rgba(255,226,170,.95)';
    ctx.beginPath(); ctx.arc(target.x * w, target.y * h, 26, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.shadowBlur = frame.pinching ? 22 : 12;
  ctx.shadowColor = frame.pinching ? 'rgba(255,214,140,1)' : 'rgba(140,190,255,1)';
  ctx.strokeStyle = frame.pinching ? 'rgba(255,224,170,.95)' : 'rgba(190,220,255,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, cursor ? (frame.pinching ? 9 : 20) : (frame.pinching ? 5 : 9), 0, Math.PI * 2); ctx.stroke();
  if (frame.pinching) { ctx.fillStyle = 'rgba(255,230,180,.55)'; ctx.fill(); }
  if (flash > 0) { // a double tap answers with a ring that opens out
    ctx.strokeStyle = `rgba(255,236,200,${flash})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, (cursor ? 20 : 9) + (1 - flash) * (cursor ? 46 : 18), 0, Math.PI * 2); ctx.stroke();
  }
}

const label = (status: Status) => status.kind === 'camera' ? '카메라 켜는 중…'
  : status.kind === 'loading' ? '손 인식 준비 중… 처음 한 번은 20초쯤 걸려요'
  : status.kind === 'waiting' ? '손바닥을 카메라에 보여주세요'
  : status.kind === 'tracking' ? '인식 중 · 집었다 놓기 클릭 · 모행성 집고 옮기기 · 주먹 모으기 · 펴기 펼치기'
  : status.message ?? '손 인식을 시작하지 못했어요.';

export default function HandControl({active, onEvents, probe, onClose}: {
  active: boolean;
  onEvents: (events: GestureEvent[]) => void;
  probe: (cursor: Point) => Point | null; // screen point (0..1 of the stage) of what the cursor would hit
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null), preview = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({kind: 'camera'});
  const [aspect, setAspect] = useState('4 / 3');
  const emit = useRef(onEvents), aim = useRef(probe);
  emit.current = onEvents; aim.current = probe;

  useEffect(() => {
    if (!active) return;
    let alive = true, frameId = 0, lastTime = -1, failures = 0, switching = false, seen = 0, shown = '', tapped = -1e9;
    let stream: MediaStream | null = null, landmarker: Landmarker | null = null;
    // Safari is steadier on the CPU path; everywhere else try the GPU first and fall back on any error.
    let delegate: Delegate = /^((?!chrome|chromium|crios|android|fxios|edg).)*safari/i.test(navigator.userAgent) ? 'CPU' : 'GPU';
    const tracker = new GestureTracker();
    const show = (next: Status) => { const key = next.kind + (next.message ?? ''); if (key !== shown && alive) { shown = key; setStatus(next); } };
    const fail = (message: string, error?: unknown) => { if (error) console.warn('[moons] hand control', error); show({kind: 'error', message}); };

    const loop = () => {
      if (!alive) return;
      frameId = requestAnimationFrame(loop);
      const v = video.current;
      if (!v || !landmarker || switching || !v.videoWidth || v.readyState < 2 || v.currentTime === lastTime) return;
      lastTime = v.currentTime;
      const now = performance.now();
      let hand: Point[] | null = null;
      try { hand = landmarker.detectForVideo(v, now).landmarks[0] ?? null; failures = 0; }
      catch (error) {
        if (++failures < 3) return;
        if (delegate === 'CPU') { cancelAnimationFrame(frameId); fail('손 인식이 이 브라우저에서 멈췄어요. 크롬에서 열어 주세요.', error); return; }
        // The GPU path broke on this machine: reload on the CPU and keep going.
        switching = true; delegate = 'CPU'; landmarker.close(); landmarker = null;
        loadLandmarker('CPU').then(next => { if (alive) { landmarker = next; failures = 0; } else next.close(); })
          .catch(e => fail('손 인식을 불러오지 못했어요. 새로고침한 뒤 다시 켜 주세요.', e))
          .finally(() => { switching = false; });
        return;
      }
      const {frame, events} = tracker.update(hand, now);
      if (frame) seen = now;
      show({kind: frame || now - seen < 600 ? 'tracking' : 'waiting'});
      if (events.some(e => e.type === 'doubleTap')) tapped = now;
      const flash = Math.max(0, 1 - (now - tapped) / 400);
      paint(preview.current, frame, p => p, false, flash);
      paint(overlay.current, frame, toScreen, true, flash, frame ? aim.current(frame.cursor) : null);
      if (events.length) emit.current(events);
    };

    (async () => {
      show({kind: 'camera'});
      if (!navigator.mediaDevices?.getUserMedia) return fail('이 브라우저에서는 카메라를 쓸 수 없어요.');
      try { stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}}, audio: false}); }
      catch (error) { return fail(cameraError(error), error); }
      const v = video.current;
      if (!alive || !v) return;
      v.srcObject = stream;
      try { await v.play(); } catch {}
      const settings = stream.getVideoTracks()[0]?.getSettings();
      if (settings?.width && settings?.height) setAspect(`${settings.width} / ${settings.height}`);
      show({kind: 'loading'});
      try { landmarker = await loadLandmarker(delegate); }
      catch (first) {
        if (delegate === 'CPU') return fail('손 인식을 불러오지 못했어요. 새로고침한 뒤 다시 켜 주세요.', first);
        delegate = 'CPU';
        try { landmarker = await loadLandmarker('CPU'); }
        catch (error) { return fail('손 인식을 불러오지 못했어요. 새로고침한 뒤 다시 켜 주세요.', error); }
      }
      if (!alive) { landmarker.close(); return; }
      show({kind: 'waiting'});
      loop();
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach(t => t.stop());
      landmarker?.close();
      paint(overlay.current, null, toScreen, true);
      emit.current([{type: 'lost'}]);
      setStatus({kind: 'camera'});
    };
  }, [active]);

  if (!active) return null;
  return <>
    <canvas ref={overlay} className="uv-hand" aria-hidden="true"/>
    <figure className="uv-cam" aria-label="손 인식 카메라">
      <div className="uv-cam-view" style={{aspectRatio: aspect}}>
        <video ref={video} playsInline muted autoPlay/>
        <canvas ref={preview} aria-hidden="true"/>
      </div>
      <p className={status.kind === 'error' ? 'error' : undefined} role="status"><span>{label(status)}</span>
        <button type="button" onClick={onClose}>끄기</button></p>
    </figure>
  </>;
}
