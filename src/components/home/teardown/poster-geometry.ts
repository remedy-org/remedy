import frames from "./poster-frames.json";
import type { BeatId } from "./model";
import type { Frame } from "./scene";

export interface PosterFrame extends Frame {
  width: number;
  height: number;
}

type Box = { left: number; top: number; width: number; height: number };

const captured: Record<string, PosterFrame> = Object.fromEntries(Object.entries(frames).map(([key, frame]) => [key, {
  ...frame,
  photo: frame.photo && {
    strength: frame.photo.strength,
    quad: frame.photo.quad.map(([x, y]): [number, number] => [x, y]),
  },
}]));

/** Apply the image's object-fit transform to its captured feature and photo coordinates. */
export function fitPosterFrame(frame: PosterFrame, box: Box, stage: Pick<Box, "left" | "top">, contain: boolean): Frame {
  const scale = (contain ? Math.min : Math.max)(box.width / frame.width, box.height / frame.height);
  const x = box.left - stage.left + (box.width - frame.width * scale) / 2;
  const y = box.top - stage.top + (box.height - frame.height * scale) / 2;
  const point = (p: { x: number; y: number }) => ({ x: x + p.x * scale, y: y + p.y * scale });
  return {
    anchor: frame.anchor && point(frame.anchor),
    photo: frame.photo && {
      strength: frame.photo.strength,
      quad: frame.photo.quad.map(([px, py]): [number, number] => [x + px * scale, y + py * scale]),
    },
  };
}

/** Geometry belongs to the exact still at its finished beat, including the non-WebGL fallback. */
export function posterFrame(beat: BeatId, small: boolean, box: Box, stage: Pick<Box, "left" | "top">): Frame | null {
  const frame = captured[`${small ? "m" : "d"}-${beat}`];
  return frame ? fitPosterFrame(frame, box, stage, small) : null;
}
