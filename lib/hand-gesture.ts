// Hand gestures for the universe screen, read from MediaPipe's 21 hand landmarks
// (x and y are 0..1 of the camera frame; 0 wrist, 4 thumb tip, 8 index tip, 9 middle knuckle, 12/16/20 other tips).
//   pinch thumb and index, release quickly  -> select what is under the cursor
//   pinch and move                           -> turn the universe
//   close the hand / open it                 -> pull the stars in / spread them out
export type Point = {x: number; y: number};
export type HandFrame = {cursor: Point; pinching: boolean; openness: number; points: Point[]};
export type GestureEvent =
  | {type: 'select'; x: number; y: number}
  | {type: 'orbit'; dx: number; dy: number}
  | {type: 'spread'; value: number}
  | {type: 'lost'};

const PINCH_ON = 0.3, PINCH_OFF = 0.45;   // thumb-index gap, in palm lengths (with hysteresis)
const FIST = 1.05, OPEN = 1.7;            // average fingertip reach from the wrist, in palm lengths
const MOVE = 0.03;                        // cursor travel that turns a pinch into a drag
const TAP_MS = 1000, LOST_MS = 400;

const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mirror = (p: Point): Point => ({x: 1 - p.x, y: p.y}); // the camera faces the person, the screen should not

export function readHand(landmarks: Point[], wasPinching: boolean): HandFrame {
  const points = landmarks.map(mirror);
  const palm = Math.max(1e-3, gap(points[0], points[9]));
  const pinch = gap(points[4], points[8]) / palm;
  const reach = [8, 12, 16, 20].reduce((sum, i) => sum + gap(points[i], points[0]), 0) / 4 / palm;
  return {
    cursor: {x: (points[4].x + points[8].x) / 2, y: (points[4].y + points[8].y) / 2},
    pinching: wasPinching ? pinch < PINCH_OFF : pinch < PINCH_ON,
    openness: Math.min(1, Math.max(0, (reach - FIST) / (OPEN - FIST))),
    points,
  };
}

export class GestureTracker {
  private pinching = false;
  private cursor: Point | null = null;
  private pinchStart: {at: Point; time: number} | null = null;
  private dragged = false;
  private seen = 0;
  private gone = true;

  update(landmarks: Point[] | null, now: number): {frame: HandFrame | null; events: GestureEvent[]} {
    const events: GestureEvent[] = [];
    if (!landmarks || landmarks.length < 21) {
      if (!this.gone && now - this.seen > LOST_MS) {
        this.gone = true; this.pinching = false; this.pinchStart = null; this.cursor = null;
        events.push({type: 'lost'});
      }
      return {frame: null, events};
    }
    this.seen = now; this.gone = false;
    const frame = readHand(landmarks, this.pinching);
    // Light smoothing: hands shake, the cursor should not.
    const previous = this.cursor;
    this.cursor = previous ? {x: previous.x + (frame.cursor.x - previous.x) * 0.5, y: previous.y + (frame.cursor.y - previous.y) * 0.5} : frame.cursor;
    frame.cursor = this.cursor;

    if (frame.pinching && !this.pinching) { this.pinchStart = {at: this.cursor, time: now}; this.dragged = false; }
    else if (frame.pinching && this.pinchStart && previous) {
      if (!this.dragged && gap(this.cursor, this.pinchStart.at) > MOVE) this.dragged = true;
      if (this.dragged) events.push({type: 'orbit', dx: this.cursor.x - previous.x, dy: this.cursor.y - previous.y});
    } else if (!frame.pinching && this.pinching && this.pinchStart) {
      if (!this.dragged && now - this.pinchStart.time < TAP_MS) events.push({type: 'select', ...this.pinchStart.at});
      this.pinchStart = null;
    }
    if (!frame.pinching) events.push({type: 'spread', value: frame.openness});
    this.pinching = frame.pinching;
    return {frame, events};
  }
}
