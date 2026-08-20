import { motion } from "framer-motion";

/**
 * Small reusable flat-illustration building blocks shared by every scene in
 * StoryCarousel (storyScenes.tsx). Kept separate so each scene file stays
 * readable and the character/prop style stays consistent across all 6
 * scenes instead of six hand-rolled variants.
 */

export interface PrimitiveMotionProps {
  /** Only loop the micro-animation while its scene is the one on screen — keeps 5 idle scenes from burning CPU. */
  active: boolean;
}

export function Sky({ from, to }: { from: string; to: string }) {
  return (
    <linearGradient id="storySky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={from} />
      <stop offset="100%" stopColor={to} />
    </linearGradient>
  );
}

export function Sun({ cx, cy, r = 26, color = "#ffd166", active }: { cx: number; cy: number; r?: number; color?: string } & PrimitiveMotionProps) {
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      opacity={0.9}
      animate={active ? { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] } : undefined}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

export function Cloud({ x, y, scale = 1, active, speed = 18 }: { x: number; y: number; scale?: number } & PrimitiveMotionProps & { speed?: number }) {
  // Static placement lives on a plain <g> — a motion.g can't carry both a
  // hand-authored `transform` attribute and an animated x/rotate/scale value;
  // framer-motion owns `transform` once it animates one of those and silently
  // drops the manual translate/scale, so the drift animates on a nested
  // motion.g using a small relative offset instead.
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <motion.g animate={active ? { x: [0, 14, 0] } : undefined} transition={{ duration: speed, repeat: Infinity, ease: "easeInOut" }}>
        <ellipse cx="0" cy="0" rx="22" ry="12" fill="#ffffff" opacity="0.85" />
        <ellipse cx="16" cy="-4" rx="14" ry="10" fill="#ffffff" opacity="0.85" />
        <ellipse cx="-16" cy="2" rx="13" ry="9" fill="#ffffff" opacity="0.85" />
      </motion.g>
    </g>
  );
}

export function Bird({ x, y, active, delay = 0 }: { x: number; y: number } & PrimitiveMotionProps & { delay?: number }) {
  return (
    <motion.path
      d={`M ${x} ${y} q 6 -6 12 0 q 6 -6 12 0`}
      stroke="#4b5563"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      animate={active ? { x: [0, 30, 60], opacity: [0, 1, 0] } : undefined}
      transition={{ duration: 6, repeat: Infinity, ease: "linear", delay }}
    />
  );
}

export function Sparkle({ x, y, size = 6, color = "#ffd166", active, delay = 0 }: { x: number; y: number; size?: number; color?: string } & PrimitiveMotionProps & { delay?: number }) {
  return (
    <motion.path
      d={`M ${x} ${y - size} L ${x + size * 0.28} ${y - size * 0.28} L ${x + size} ${y} L ${x + size * 0.28} ${y + size * 0.28} L ${x} ${y + size} L ${x - size * 0.28} ${y + size * 0.28} L ${x - size} ${y} L ${x - size * 0.28} ${y - size * 0.28} Z`}
      fill={color}
      animate={active ? { opacity: [0.2, 1, 0.2], scale: [0.7, 1, 0.7] } : { opacity: 0.7 }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    />
  );
}

/** Oval head silhouette scaled to radius r — same proportions as Figure's head, for the smaller hand-built characters (van window passengers, seated exam students, the Congratulations hug) that need a face but not a full Figure. Keeps "no raw circles for heads" true everywhere, not just in Figure. */
export function headPath(r: number) {
  const k = r / 18;
  return `M ${-15 * k} ${-20 * k} C ${-15 * k} ${-32 * k} ${-8 * k} ${-38 * k} 0 ${-38 * k} C ${8 * k} ${-38 * k} ${15 * k} ${-32 * k} ${15 * k} ${-20 * k} C ${15 * k} ${-10 * k} ${11 * k} ${-2 * k} 0 ${-1 * k} C ${-11 * k} ${-2 * k} ${-15 * k} ${-10 * k} ${-15 * k} ${-20 * k} Z`;
}

/** Side-swept hair cap matching headPath's proportions at the same radius. */
export function hairPath(r: number) {
  const k = r / 18;
  return `M ${-16 * k} ${-21 * k} C ${-17 * k} ${-35 * k} ${-9 * k} ${-42 * k} 0 ${-42 * k} C ${9 * k} ${-42 * k} ${17 * k} ${-34 * k} ${16 * k} ${-21 * k} C ${12 * k} ${-26 * k} ${8 * k} ${-30 * k} ${1 * k} ${-30 * k} C ${-5 * k} ${-30 * k} ${-11 * k} ${-26 * k} ${-16 * k} ${-21 * k} Z`;
}

export interface FigureProps extends PrimitiveMotionProps {
  x: number;
  y: number;
  height?: number;
  skin?: string;
  outfit?: string;
  hair?: string;
  /** Idle motion style: "sway" (side-to-side, default — a standing figure), "nod" (small vertical nod, e.g. a parent listening attentively), "idle" (gentle breathing + an occasional glance, for a figure that's just waiting), or "none" (fully still, e.g. a background/seated figure). */
  gesture?: "sway" | "nod" | "idle" | "none";
  /** Adds a subtle mouth open/close pulse so a figure reads as mid-conversation rather than just idling. */
  talking?: boolean;
  /** Slow smile-widen pulse — reads as a shifting happy expression rather than speech; pairs well with "nod". */
  expressive?: boolean;
  /** Adds a small white collar wedge at the neckline for a business-casual look (teacher/parent in office scenes). */
  collar?: boolean;
  delay?: number;
}

/**
 * Premium flat-illustration figure — an oval (not circular) head with a
 * side-swept hairline, a shoulder-to-hem clothing silhouette, and curved
 * tapered limbs (not straight rect "sticks"). No raw circles: eyes and
 * hands/shoes are ellipses. Reused (at different scale/colors) for every
 * parent, teacher and child across all 6 scenes so the cast reads as one
 * consistent, non-blocky art style.
 */
export function Figure({
  x,
  y,
  height = 100,
  skin = "#f2c29a",
  outfit = "#4fa1ff",
  hair = "#3b2a20",
  active,
  gesture = "sway",
  talking = false,
  expressive = false,
  collar = false,
  delay = 0,
}: FigureProps) {
  const s = height / 100;
  const gestureAnimate =
    gesture === "sway"
      ? { rotate: [-1.4, 1.4, -1.4] }
      : gesture === "nod"
      ? { y: [0, -3, 0, -3, 0] }
      : gesture === "idle"
      ? { scaleY: [1, 1.018, 1, 1.012, 1], rotate: [0, -1, 0, 1.5, 0] }
      : undefined;
  const gestureDuration = gesture === "nod" ? 1.7 : gesture === "idle" ? 2.8 : 3.4;
  // Static translate/scale on a plain <g> (see Cloud's comment above — a
  // motion.g can't own both a manual `transform` attribute and an animated
  // rotate/x/scale value), with the idle gesture on a nested motion.g
  // pivoting around an origin local to the figure itself so it works at any
  // x/y/scale.
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <motion.g
        animate={active && gestureAnimate ? gestureAnimate : undefined}
        transition={{ duration: gestureDuration, repeat: Infinity, ease: "easeInOut", delay }}
        style={{ transformOrigin: "0px 68px" }}
      >
        {/* legs — curved, tapered strokes instead of straight rect "sticks" */}
        <path d="M -8 46 Q -13 64 -11 84" stroke={outfit} strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.94" />
        <path d="M 8 46 Q 13 64 11 84" stroke={outfit} strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.94" />
        <ellipse cx="-11" cy="86" rx="6.5" ry="3" fill="#374151" />
        <ellipse cx="11" cy="86" rx="6.5" ry="3" fill="#374151" />

        {/* torso — one shoulder-to-hem clothing silhouette instead of a plain block */}
        <path
          d="M -16 6 C -17 -2 -13 -6 -7 -8 C -3 -9 3 -9 7 -8 C 13 -6 17 -2 16 6 L 15 40 C 15 47 9 51 0 51 C -9 51 -15 47 -15 40 Z"
          fill={outfit}
        />

        {/* arms — curved, tapered strokes with a rounded hand */}
        <path d="M -13 0 Q -23 16 -19 40" stroke={outfit} strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M 13 0 Q 23 16 19 40" stroke={outfit} strokeWidth="9" strokeLinecap="round" fill="none" />
        <ellipse cx="-19" cy="41" rx="4" ry="4.6" fill={skin} />
        <ellipse cx="19" cy="41" rx="4" ry="4.6" fill={skin} />

        {collar && <path d="M -7 -6 L 0 5 L 7 -6 Z" fill="#ffffff" opacity="0.95" />}

        {/* head — an oval silhouette, not a raw circle */}
        <path d="M -15 -20 C -15 -32 -8 -38 0 -38 C 8 -38 15 -32 15 -20 C 15 -10 11 -2 0 -1 C -11 -2 -15 -10 -15 -20 Z" fill={skin} />

        {/* hair — a side-swept cap instead of a symmetric bang wedge */}
        <path d="M -16 -21 C -17 -35 -9 -42 0 -42 C 9 -42 17 -34 16 -21 C 12 -26 8 -30 1 -30 C -5 -30 -11 -26 -16 -21 Z" fill={hair} />

        <ellipse cx="-6" cy="-21" rx="1.5" ry="2" fill="#2b2b2b" />
        <ellipse cx="6" cy="-21" rx="1.5" ry="2" fill="#2b2b2b" />
        <motion.path
          d="M -6 -11 Q 0 -6 6 -11"
          stroke="#2b2b2b"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          animate={
            active && talking
              ? { scaleY: [1, 1.7, 1] }
              : active && expressive
              ? { scaleX: [1, 1.22, 1] }
              : undefined
          }
          transition={{ duration: talking ? 0.5 : 2.4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.2 }}
          style={{ transformOrigin: "0px -11px" }}
        />
      </motion.g>
    </g>
  );
}

export interface ConfettiPieceProps extends PrimitiveMotionProps {
  x: number;
  delay: number;
  color: string;
  /** Bigger/lighter pieces drift further sideways and fall slower — a cheap stand-in for per-piece air resistance so the burst doesn't fall as one uniform sheet. */
  weight?: "light" | "medium" | "heavy";
  /** "streamer" is a longer, narrower ribbon shape instead of a square/circle confetti chip. */
  shape?: "square" | "circle" | "streamer";
}

const CONFETTI_WEIGHT = {
  light: { duration: 4.2, drift: 26, w: 5, h: 5 },
  medium: { duration: 3.4, drift: 15, w: 6, h: 10 },
  heavy: { duration: 2.6, drift: 6, w: 7, h: 12 },
} as const;

export function ConfettiPiece({ x, delay, color, active, weight = "medium", shape = "square" }: ConfettiPieceProps) {
  const { duration, drift, w, h } = CONFETTI_WEIGHT[weight];
  // Gravity-with-air-resistance stand-in: the piece falls fast and settles
  // toward a near-terminal rate rather than accelerating the whole way down,
  // so the fall itself uses an ease-out timing curve.
  const transition = { duration, repeat: Infinity, ease: "easeOut" as const, delay };
  const xKeyframes = [x, x + drift, x - drift * 0.6, x];

  if (shape === "circle") {
    // Mixing animated cx/cy (SVG attrs) with animated rotate (a transform) on
    // one element makes framer-motion emit invalid cy values — so the base
    // position is a static translate on a plain <g>, and only pure transform
    // values (x/y/rotate, no clashing attrs) animate on the circle itself.
    return (
      <g transform={`translate(${x} -10)`}>
        <motion.circle
          cx={0}
          cy={0}
          r={w / 2}
          fill={color}
          animate={active ? { y: [0, 220], x: [0, drift, -drift * 0.6, 0], rotate: [0, 260], opacity: [1, 1, 0] } : { y: 0, opacity: 0 }}
          transition={transition}
        />
      </g>
    );
  }
  const fallAnimate = active ? { y: [-10, 210], x: xKeyframes, rotate: [0, 260], opacity: [1, 1, 0] } : { y: -10, opacity: 0 };
  if (shape === "streamer") {
    return <motion.rect x={x} y={-14} width={w * 0.55} height={h * 2.2} rx={w * 0.3} fill={color} opacity={0.9} animate={fallAnimate} transition={transition} />;
  }
  return <motion.rect x={x} y={-10} width={w} height={h} rx={1.5} fill={color} animate={fallAnimate} transition={transition} />;
}

export function Ground({ y, color }: { y: number; color: string }) {
  return <rect x="-140" y={y} width="760" height="80" fill={color} />;
}
