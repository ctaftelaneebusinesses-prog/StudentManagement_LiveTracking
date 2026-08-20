import { ComponentType, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bird, Cloud, ConfettiPiece, Figure, Ground, hairPath, headPath, Sparkle, Sun } from "./storyPrimitives";

export interface StorySceneIllustrationProps {
  active: boolean;
  /** Current school's display name (from useSchool()); only JourneyScene's building facade reads it. */
  schoolName?: string;
}

// Physics-feeling deceleration curve shared by every one-shot "settle in" reveal
// (van glide, chalkboard pop, bar-chart grow) so nothing in the carousel starts
// or stops on a rigid linear/easeOut edge.
const DECELERATE = [0.25, 1, 0.5, 1] as const;

function truncateSchoolName(name?: string) {
  const trimmed = (name ?? "").trim() || "Your School";
  return trimmed.length > 24 ? `${trimmed.slice(0, 22)}…` : trimmed;
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(" ");
}

export interface StoryScene {
  id: string;
  emoji: string;
  title: string;
  caption: string;
  /** Autoplay dwell time in ms — kept inside the requested 5–8s window, varied slightly so the story doesn't feel metronomic. */
  duration: number;
  Illustration: ComponentType<StorySceneIllustrationProps>;
}

// Scene content is hand-composed within a 480-wide window; the viewBox is
// padded 110 units on each side (and preserveAspectRatio="slice" below fills
// the card edge-to-edge) so very wide desktop banners crop the empty sky/
// ground margin instead of cropping the characters themselves.
const VIEW = "-110 0 700 260";

function SchoolMorningScene({ active }: StorySceneIllustrationProps) {
  return (
    <svg viewBox={VIEW} className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A school van arrives while a parent and child wait happily at the bus stop">
      <defs>
        <linearGradient id="morningSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe3b0" />
          <stop offset="55%" stopColor="#bfe3ff" />
          <stop offset="100%" stopColor="#eaf6ff" />
        </linearGradient>
        <linearGradient id="steelGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect x="-110" width="700" height="260" fill="url(#morningSky)" />
      <Sun cx={66} cy={54} active={active} />
      <Cloud x={330} y={50} active={active} speed={16} />
      <Cloud x={230} y={30} scale={0.7} active={active} speed={22} />
      <Bird x={150} y={40} active={active} />
      <Bird x={170} y={55} active={active} delay={1.2} />
      <Ground y={210} color="#d8ede2" />
      <rect x="-110" y="205" width="700" height="10" fill="#b9d6c4" />

      {/* Transit event: glide-in on the physics ease, then a brief suspension
          dip timed to land right as the van reaches its stop — braking, not
          just arriving. */}
      <motion.g initial={{ x: -170 }} animate={{ x: 0 }} transition={{ duration: 1.3, ease: DECELERATE }}>
        <motion.g
          animate={{ y: [0, 0, 4, -1.5, 0] }}
          transition={{ duration: 1.3, times: [0, 0.83, 0.9, 0.96, 1], ease: "easeOut" }}
        >
          <g transform="translate(50 130)">
            <rect x="0" y="30" width="130" height="60" rx="22" fill="#ffcf5c" />
            <rect x="0" y="18" width="130" height="26" rx="13" fill="#ff9f4a" />
            {/* tinted glass windows with soft interior silhouettes */}
            {[
              { wx: 14, ww: 30 },
              { wx: 52, ww: 30 },
              { wx: 90, ww: 28 },
            ].map((w) => (
              <g key={w.wx}>
                <rect x={w.wx} y="46" width={w.ww} height="24" rx="7" fill="#8fb3d9" opacity="0.5" />
                <circle cx={w.wx + w.ww / 2} cy="61" r="7" fill="#2f4a68" opacity="0.55" />
              </g>
            ))}
            <circle cx="26" cy="94" r="11" fill="#2b2b2b" />
            <circle cx="26" cy="94" r="4" fill="#9ca3af" />
            <circle cx="104" cy="94" r="11" fill="#2b2b2b" />
            <circle cx="104" cy="94" r="4" fill="#9ca3af" />
            <motion.circle
              cx={16}
              cy={30}
              r={5}
              fill="#fff7cc"
              animate={active ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.6 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </g>
        </motion.g>
      </motion.g>

      {/* Sleek modern transit pavilion: steel pillars + a glass roof and wind-break panel */}
      <g transform="translate(330 148)">
        <rect x="-46" y="0" width="10" height="44" fill="url(#glassGrad)" stroke="#cbd5e1" strokeWidth="1" />
        <rect x="-36" y="-2" width="5" height="50" rx="2" fill="url(#steelGrad)" />
        <rect x="31" y="-2" width="5" height="50" rx="2" fill="url(#steelGrad)" />
        <path d="M -46 -2 L 46 -10 L 46 -2 L -46 4 Z" fill="url(#glassGrad)" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M -40 -3 L 20 -8" stroke="#ffffff" strokeWidth="1.5" opacity="0.65" strokeLinecap="round" />
        <rect x="-28" y="40" width="58" height="5" rx="2" fill="#c9a876" />
        <rect x="-24" y="45" width="4" height="10" fill="url(#steelGrad)" />
        <rect x="20" y="45" width="4" height="10" fill="url(#steelGrad)" />
      </g>

      <Figure x={272} y={150} height={92} skin="#e3a570" outfit="#5b6b82" hair="#241c15" active={active} gesture="idle" delay={0.1} />
      <Figure x={252} y={172} height={56} skin="#f2c29a" outfit="#ea72c3" hair="#5a3a20" active={active} gesture="idle" delay={0.6} />

      <motion.g
        animate={active ? { y: [0, -6, 0], opacity: [0.4, 1, 0.4] } : { opacity: 0.8 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M262 86 q6 -10 12 0 q6 -10 12 0 q0 10 -12 16 q-12 -6 -12 -16 Z" fill="#ff6b8b" />
      </motion.g>
    </svg>
  );
}

function JourneyScene({ active, schoolName }: StorySceneIllustrationProps) {
  const displayName = truncateSchoolName(schoolName);
  const nameFontSize = displayName.length > 16 ? 8.5 : displayName.length > 11 ? 10 : 12;
  return (
    <svg
      viewBox={VIEW}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`The school van travels from home to ${displayName}`}
    >
      <defs>
        <linearGradient id="journeySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe3ff" />
          <stop offset="100%" stopColor="#eaf6ff" />
        </linearGradient>
      </defs>
      <rect x="-110" width="700" height="260" fill="url(#journeySky)" />
      <Sun cx={420} cy={40} r={20} active={active} />

      {/* Tier 1 (farthest): sky clouds, barely drifting */}
      <Cloud x={20} y={36} scale={0.8} active={active} speed={50} />
      <Cloud x={300} y={30} scale={0.6} active={active} speed={60} />

      {/* Tier 2: soft distant hills drifting slowly for depth */}
      <motion.g animate={active ? { x: [0, -26, 0] } : undefined} transition={{ duration: 42, repeat: Infinity, ease: "linear" }}>
        <ellipse cx="-40" cy="196" rx="90" ry="24" fill="#d7ecff" opacity="0.65" />
        <ellipse cx="200" cy="200" rx="120" ry="26" fill="#d7ecff" opacity="0.55" />
        <ellipse cx="440" cy="196" rx="100" ry="24" fill="#d7ecff" opacity="0.65" />
      </motion.g>

      {/* Tier 2b: mid-ground houses, drifting slower than the foreground trees but faster than the background hills */}
      {[0, 1, 2].map((i) => (
        <motion.g
          key={`house-${i}`}
          animate={active ? { x: [600 + i * 220, -260 + i * 220] } : undefined}
          transition={{ duration: 16, repeat: Infinity, ease: "linear", delay: i * 2.4 }}
        >
          <g transform="translate(0 176)">
            <rect x="-24" y="-4" width="48" height="28" fill="#f4dcc0" />
            <polygon points="-28,-4 0,-24 28,-4" fill="#c9836a" />
            <rect x="-6" y="8" width="12" height="16" fill="#8a6a44" />
            <rect x="-18" y="4" width="8" height="8" fill="#bfe3ff" opacity="0.85" />
            <rect x="10" y="4" width="8" height="8" fill="#bfe3ff" opacity="0.85" />
          </g>
        </motion.g>
      ))}

      {/* Tier 3 (nearest): trees passing at their own, faster speed, independent of the van */}
      {[0, 1, 2, 3].map((i) => (
        <motion.g
          key={i}
          animate={active ? { x: [560 + i * 130, -200 + i * 130] } : undefined}
          transition={{ duration: 6, repeat: Infinity, ease: "linear", delay: i * 0.9 }}
        >
          <rect x="0" y="152" width="30" height="36" rx="4" fill="#9fd6b5" />
          <polygon points="15,122 0,152 30,152" fill="#7cc79c" />
        </motion.g>
      ))}

      <rect x="-110" y="206" width="700" height="40" fill="#8a93a1" />
      <motion.g animate={active ? { x: [0, -46, 0] } : undefined} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={-140 + i * 62} y="224" width="28" height="6" rx="3" fill="#ffe27a" />
        ))}
      </motion.g>

      {/* Home node — journey start, anchored at the left */}
      <g transform="translate(-72 148)">
        <rect x="-15" y="-30" width="30" height="15" rx="6" fill="#63c78a" />
        <text x="0" y="-19" textAnchor="middle" fontSize="7.5" fill="#ffffff" fontFamily="ui-sans-serif, system-ui" fontWeight="700">
          HOME
        </text>
        <rect x="-26" y="10" width="52" height="40" rx="3" fill="#ffcf5c" />
        <polygon points="-32,10 0,-16 32,10" fill="#ff9f4a" />
        <rect x="-8" y="26" width="16" height="24" rx="2" fill="#8a6a44" />
        <rect x="-20" y="18" width="10" height="10" rx="2" fill="#eaf6ff" opacity="0.9" />
        <rect x="10" y="18" width="10" height="10" rx="2" fill="#eaf6ff" opacity="0.9" />
      </g>

      {/* School node — journey end, with the current school's own name on the facade */}
      <g transform="translate(520 58)">
        <polygon points="-78,42 0,4 78,42" fill="#4a3aa7" />
        <rect x="-6" y="16" width="12" height="18" fill="#ffd166" />
        <rect x="-70" y="42" width="140" height="108" fill="#ffffff" stroke="#c7d2db" strokeWidth="2" />
        <rect x="-60" y="48" width="120" height="18" rx="3" fill="#eef0ff" />
        <text x="0" y="60.5" textAnchor="middle" fontSize={nameFontSize} fontFamily="ui-sans-serif, system-ui" fontWeight="700" fill="#2f2a4a">
          {displayName}
        </text>
        {[-50, -18, 14, 46].map((bx) => (
          <rect key={bx} x={bx} y="76" width="14" height="22" rx="2" fill="#bfe3ff" />
        ))}
        <rect x="-16" y="114" width="32" height="36" rx="2" fill="#4a3aa7" />
      </g>

      {/* Van journeying between the two nodes, with its own micro-bounce chassis physics */}
      <motion.g
        animate={active ? { x: [-40, 460] } : undefined}
        transition={{ duration: 7, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      >
        {/* Micro-vibrational chassis oscillation — small and quick, reading as an idling engine rather than a bounce */}
        <motion.g animate={active ? { y: [0, -1, 0.5, -0.8, 0] } : undefined} transition={{ duration: 0.22, repeat: Infinity, ease: "easeInOut" }}>
          <rect x="0" y="120" width="110" height="70" rx="20" fill="#ffcf5c" />
          <rect x="0" y="106" width="110" height="26" rx="13" fill="#ff9f4a" />
          <circle cx="26" cy="192" r="14" fill="#2b2b2b" />
          <circle cx="26" cy="192" r="5" fill="#9ca3af" />
          <circle cx="84" cy="192" r="14" fill="#2b2b2b" />
          <circle cx="84" cy="192" r="5" fill="#9ca3af" />

          {[
            { cx: 26, skin: "#f2c29a", hair: "#3b2a20" },
            { cx: 55, skin: "#c98a56", hair: "#1f1f1f" },
            { cx: 84, skin: "#8a5a35", hair: "#241c15" },
          ].map((k, i) => (
            <g key={i}>
              <rect x={k.cx - 14} y="128" width="28" height="26" rx="6" fill="#eaf6ff" opacity="0.92" />
              <g transform={`translate(${k.cx} 151)`}>
                <path d={headPath(10)} fill={k.skin} />
                <path d={hairPath(10)} fill={k.hair} />
              </g>
            </g>
          ))}

          <motion.rect
            x={8}
            y={140}
            width={4}
            height={13}
            rx={2}
            fill="#f2c29a"
            animate={active ? { rotate: [-8, 32, -8] } : undefined}
            transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "10px 140px" }}
          />

          <motion.circle
            cx={106}
            cy={132}
            r={4}
            fill="#fff7cc"
            animate={active ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.6 }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.g>
      </motion.g>
    </svg>
  );
}

/** Hour/minute hands read the visitor's actual clock; the second hand keeps ticking live in real time while the scene is on screen. */
function LiveClockHands({ active }: { active: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  return (
    <>
      <line x1="0" y1="0" x2="0" y2="-8" stroke="#2b2b2b" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${hours * 30})`} />
      <line x1="0" y1="0" x2="0" y2="-12" stroke="#2b2b2b" strokeWidth="1.8" strokeLinecap="round" transform={`rotate(${minutes * 6})`} />
      <motion.line
        x1="0"
        y1="2"
        x2="0"
        y2="-14"
        stroke="#ef4444"
        strokeWidth="1"
        strokeLinecap="round"
        animate={{ rotate: seconds * 6 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ transformOrigin: "0px 0px" }}
      />
    </>
  );
}

function ExamDayScene({ active }: StorySceneIllustrationProps) {
  const desks = [90, 210, 330];
  return (
    <svg viewBox={VIEW} className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Students calmly writing their exam in the classroom">
      <rect x="-110" width="700" height="260" fill="#eef3f6" />
      <rect x="-110" y="0" width="700" height="150" fill="#dbe7ee" />

      <motion.g
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: DECELERATE, delay: 0.15 }}
        style={{ transformOrigin: "240px 67px" }}
      >
        <rect x="150" y="24" width="180" height="86" rx="8" fill="#2f4a3e" />
        <rect x="150" y="24" width="180" height="86" rx="8" fill="none" stroke="#4a6b58" strokeWidth="3" />
        <text x="240" y="60" textAnchor="middle" fontSize="15" fontFamily="ui-sans-serif, system-ui" fill="#eaf6ff" fontWeight="600">
          Today is Exam.
        </text>
        <text x="240" y="82" textAnchor="middle" fontSize="11" fontFamily="ui-sans-serif, system-ui" fill="#c7e8d6">
          All the best!
        </text>
        <rect x="158" y="106" width="18" height="5" rx="2" fill="#eaf6ff" opacity="0.85" />
        <rect x="180" y="106" width="14" height="5" rx="2" fill="#ff9f4a" opacity="0.85" />
      </motion.g>

      <g transform="translate(392 34)">
        <circle cx="0" cy="0" r="20" fill="#ffffff" stroke="#c7d2db" strokeWidth="3" />
        <LiveClockHands active={active} />
      </g>

      <Ground y={140} color="#eef3f6" />
      {desks.map((x, i) => (
        <g key={x} transform={`translate(${x} 150)`}>
          <rect x="-38" y="46" width="76" height="8" rx="3" fill="#c9a876" />
          <rect x="-30" y="54" width="8" height="26" fill="#a9835a" />
          <rect x="22" y="54" width="8" height="26" fill="#a9835a" />
          {/* laptop, alongside the exam sheet */}
          <rect x="-34" y="27" width="18" height="14" rx="1.5" fill="#334155" />
          <rect x="-31" y="29" width="12" height="10" rx="1" fill="#7dd3fc" opacity="0.75" />
          <rect x="-34" y="41" width="20" height="4" rx="1" fill="#64748b" />
          <rect x="-8" y="40" width="32" height="10" rx="2" fill="#ffffff" />
          <motion.line
            x1="10"
            y1="45"
            x2="18"
            y2="45"
            stroke="#4b5563"
            strokeWidth="1.6"
            strokeLinecap="round"
            animate={active ? { rotate: [-6, 6, -6] } : undefined}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
            style={{ transformOrigin: "10px 45px" }}
          />
          <g transform="translate(0 31)">
            <path d={headPath(16)} fill={["#f2c29a", "#c98a56", "#8a5a35"][i]} />
            <path d={hairPath(16)} fill={["#3b2a20", "#1f1f1f", "#241c15"][i]} />
            <ellipse cx="-5" cy="-17" rx="1.4" ry="1.8" fill="#2b2b2b" />
            <ellipse cx="5" cy="-17" rx="1.4" ry="1.8" fill="#2b2b2b" />
            <path d="M -4 -12 Q 0 -10 4 -12" stroke="#2b2b2b" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </g>
        </g>
      ))}
    </svg>
  );
}

function PTMScene({ active }: StorySceneIllustrationProps) {
  return (
    <svg
      viewBox={VIEW}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Teacher pointing to a progress chart on a monitor while parent and student look on in a modern office"
    >
      <defs>
        <linearGradient id="ptmBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef2f7" />
          <stop offset="100%" stopColor="#e3ebf3" />
        </linearGradient>
      </defs>
      <rect x="-110" width="700" height="260" fill="url(#ptmBg)" />
      <rect x="-110" y="195" width="700" height="65" fill="#dbe4ee" />

      {/* Window with blinds */}
      <rect x="-95" y="20" width="90" height="100" rx="6" fill="#bfe0f5" stroke="#c7d2db" strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="-91" y={26 + i * 18} width="82" height="6" rx="2" fill="#eef2f7" opacity="0.85" />
      ))}

      {/* Minimalist indoor plant */}
      <g transform="translate(505 195)">
        <path d="M -14 10 L 14 10 L 10 -2 L -10 -2 Z" fill="#c98a56" />
        <motion.g
          animate={active ? { rotate: [-2, 2, -2] } : undefined}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "0px -2px" }}
        >
          <path d="M 0 -2 Q -14 -30 -4 -46" stroke="#4a7a55" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M 0 -2 Q 4 -34 -2 -52" stroke="#63c78a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M 0 -2 Q 16 -28 10 -44" stroke="#4a7a55" strokeWidth="4" fill="none" strokeLinecap="round" />
        </motion.g>
      </g>

      {/* Teacher's office chair — backrest hugging just behind the head/shoulders, rest hidden behind the desk */}
      <rect x="175" y="85" width="50" height="68" rx="20" fill="#47536b" />

      <Figure x={200} y={105} height={58} skin="#c98a56" outfit="#2f3a56" hair="#1f1f1f" active={active} gesture="none" collar delay={0.15} />

      {/* Desk, drawn as a trapezoid so the surface reads as receding into a three-quarter view */}
      <polygon points="170,148 310,148 345,182 135,182" fill="#c9a876" stroke="#a9835a" strokeWidth="2" />
      <polygon points="135,182 345,182 345,208 135,208" fill="#a9835a" />

      {/* Ultra-thin monitor on the desk, facing the parent and student */}
      <ellipse cx="280" cy="170" rx="15" ry="3" fill="#1f2430" opacity="0.5" />
      <rect x="277" y="152" width="6" height="18" fill="#1f2430" />
      <rect x="247" y="100" width="66" height="52" rx="5" fill="#1f2430" />
      <rect x="251" y="104" width="58" height="44" rx="2" fill="#f4f7fb" />
      <circle cx="256" cy="110" r="1.2" fill="#ef4444" />
      <circle cx="260" cy="110" r="1.2" fill="#f59e0b" />
      <circle cx="264" cy="110" r="1.2" fill="#22c55e" />
      <motion.path
        d="M253,138 L263,128 L273,132 L283,118 L293,122 L305,110"
        stroke="#2f7dfa"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.4, ease: DECELERATE }}
      />
      <motion.path
        d="M253,134 L268,122 L283,118 L305,106"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeDasharray="4 3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.65, ease: DECELERATE }}
      />

      {/* Parent's visitor chair */}
      <g transform="translate(150 178)">
        <rect x="-18" y="-4" width="36" height="10" rx="4" fill="#8a93a1" />
        <rect x="-18" y="-38" width="8" height="34" rx="3" fill="#8a93a1" />
        <rect x="-22" y="6" width="5" height="16" fill="#6b7280" />
        <rect x="17" y="6" width="5" height="16" fill="#6b7280" />
      </g>
      <Figure x={150} y={125} height={88} skin="#f2c29a" outfit="#2f7dfa" hair="#5a3a20" active={active} gesture="nod" expressive collar delay={0.4} />

      {/* Student's taller stool, with dangling legs that swing */}
      <g transform="translate(310 176)">
        <ellipse cx="0" cy="34" rx="14" ry="3" fill="#c7d2db" />
        <rect x="-3" y="4" width="6" height="30" fill="#9aa3ad" />
        <rect x="-16" y="-2" width="32" height="8" rx="4" fill="#4fa1ff" />
      </g>
      <g transform="translate(310 150)">
        <motion.g
          animate={active ? { rotate: [-6, 8, -6] } : undefined}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "-6px 24px" }}
        >
          <rect x="-10" y="24" width="7" height="26" rx="3" fill="#e3a570" />
        </motion.g>
        <motion.g
          animate={active ? { rotate: [6, -8, 6] } : undefined}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          style={{ transformOrigin: "6px 24px" }}
        >
          <rect x="3" y="24" width="7" height="26" rx="3" fill="#e3a570" />
        </motion.g>
        <rect x="-14" y="0" width="28" height="28" rx="12" fill="#ffcf5c" />
        <g transform="rotate(12)">
          <circle cx="0" cy="-14" r="14" fill="#c98a56" />
          <path d="M -14 -20 Q 0 -34 14 -20 Q 14 -26 0 -28 Q -14 -26 -14 -20 Z" fill="#1f1f1f" />
          <circle cx="-4" cy="-14" r="1.3" fill="#2b2b2b" />
          <circle cx="4" cy="-14" r="1.3" fill="#2b2b2b" />
          <path d="M -4 -9 Q 0 -6 4 -9" stroke="#2b2b2b" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* Teacher's arm — a smooth one-shot reveal into the pointing pose, then a small idle wobble */}
      <motion.g initial={{ rotate: -35 }} animate={{ rotate: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: DECELERATE }} style={{ transformOrigin: "212px 118px" }}>
        <motion.g
          animate={active ? { rotate: [-4, 3, -4] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
          style={{ transformOrigin: "212px 118px" }}
        >
          <line x1={212} y1={118} x2={244} y2={126} stroke="#c98a56" strokeWidth="4" strokeLinecap="round" />
          <circle cx={244} cy={126} r={3.4} fill="#c98a56" />
        </motion.g>
      </motion.g>

      <motion.g
        animate={active ? { y: [0, -5, 0], opacity: [0.35, 1, 0.35] } : { opacity: 0.85 }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="280" cy="66" r="14" fill="#ffffff" opacity="0.95" />
        <path d="M270 76 l6 8 l6 -8" fill="#ffffff" opacity="0.95" />
        <path d="M280 60 l2 5 l5 1 l-4 4 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -4 l5 -1 Z" fill="#f59e0b" />
      </motion.g>
    </svg>
  );
}

function CongratulationsScene({ active }: StorySceneIllustrationProps) {
  const confettiColors = ["#ff6b8b", "#4fa1ff", "#ffd166", "#63c78a", "#9b8cff"];
  const shapes = ["square", "circle", "streamer"] as const;
  const motherColor = "#3457d5";
  const childColor = "#f0a93a";
  return (
    <svg viewBox={VIEW} className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mother and child sharing a proud hug beside a trophy, with confetti falling">
      <defs>
        <linearGradient id="congratsBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="55%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#c026a3" />
        </linearGradient>
        <radialGradient id="cinematicGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#fff4d6" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#fff4d6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="trophyGoldGrad" cx="35%" cy="22%" r="85%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="45%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#e8960c" />
        </radialGradient>
        <linearGradient id="marbleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3f52" />
          <stop offset="100%" stopColor="#14151c" />
        </linearGradient>
        <clipPath id="trophyCupClip">
          <path d="M -20 6 Q -24 -34 0 -34 Q 24 -34 20 6 Z" />
        </clipPath>
        <filter id="congratsSoftBlur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect x="-110" width="700" height="260" fill="url(#congratsBg)" />
      <ellipse cx="240" cy="110" rx="260" ry="150" fill="url(#cinematicGlow)" />
      <Ground y={205} color="#3b0a5e" />

      {/* Confetti burst from the top-left and top-right corners, mixed shapes */}
      {Array.from({ length: 22 }).map((_, i) => {
        const fromLeft = i % 2 === 0;
        const edgeX = fromLeft ? -100 + (i % 6) * 16 : 470 - (i % 6) * 16;
        return (
          <ConfettiPiece
            key={i}
            x={edgeX}
            delay={(i % 7) * 0.22}
            color={confettiColors[i % confettiColors.length]}
            weight={(["light", "medium", "heavy"] as const)[i % 3]}
            shape={shapes[i % shapes.length]}
            active={active}
          />
        );
      })}

      {/* Achievement asset — a detailed trophy on a polished marble platform, balancing the hug on the left */}
      <g transform="translate(90 165)">
        <ellipse cx="4" cy="50" rx="42" ry="9" fill="#000000" opacity="0.3" filter="url(#congratsSoftBlur)" />
        <ellipse cx="0" cy="46" rx="38" ry="8" fill="url(#marbleGrad)" />
        <rect x="-30" y="30" width="60" height="16" rx="4" fill="url(#marbleGrad)" />
        <rect x="-24" y="33" width="18" height="3" rx="1.5" fill="#ffffff" opacity="0.14" />
        <rect x="-18" y="20" width="36" height="10" rx="2" fill="#c97a06" />
        <rect x="-8" y="6" width="16" height="16" fill="#e8960c" />

        <motion.g
          animate={active ? { y: [0, -6, 0], rotate: [-2, 2, -2] } : undefined}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "0px 6px" }}
        >
          <path d="M -20 6 Q -24 -34 0 -34 Q 24 -34 20 6 Z" fill="url(#trophyGoldGrad)" stroke="#c97a06" strokeWidth="1.5" />
          <path d="M -20 -18 Q -36 -16 -34 -2 Q -32 8 -20 6" fill="none" stroke="url(#trophyGoldGrad)" strokeWidth="4" strokeLinecap="round" />
          <path d="M 20 -18 Q 36 -16 34 -2 Q 32 8 20 6" fill="none" stroke="url(#trophyGoldGrad)" strokeWidth="4" strokeLinecap="round" />
          <polygon points={starPoints(0, -14, 7, 3)} fill="#fff3c4" opacity="0.9" />
          {/* A constant soft gleam, plus the animated shimmer sweep below, so the cup always catches some light */}
          <g clipPath="url(#trophyCupClip)">
            <ellipse cx="-9" cy="-20" rx="5" ry="10" fill="#ffffff" opacity="0.35" transform="rotate(-18 -9 -20)" />
          </g>
          {/* Shimmer overlay: a diagonal sweep clipped to the cup, looping every 3s */}
          <g clipPath="url(#trophyCupClip)">
            <g transform="skewX(-20)">
              <motion.rect
                x={-40}
                y={-40}
                width={16}
                height={60}
                fill="#ffffff"
                opacity={0.55}
                animate={active ? { x: [-40, 40] } : undefined}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.9 }}
              />
            </g>
          </g>
        </motion.g>
        <Sparkle x={-30} y={-30} active={active} delay={0.2} />
        <Sparkle x={34} y={-22} size={5} active={active} delay={0.8} />
      </g>

      {/* Mother and child embrace — overlapping, interlocking shapes rather than two separate figures joined by a line */}
      <g transform="translate(360 150)">
        <ellipse cx="6" cy="58" rx="48" ry="9" fill="#000000" opacity="0.28" filter="url(#congratsSoftBlur)" />

        {/* far arm, wraps behind the child */}
        <motion.path
          d="M -20 -2 Q 12 18 28 34"
          stroke={motherColor}
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          animate={active ? { pathLength: [0.9, 1, 0.9] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* mother's torso */}
        <rect x="-38" y="-8" width="56" height="60" rx="26" fill={motherColor} transform="rotate(-4)" />
        <g transform="translate(-12 -10)">
          <path d={headPath(18)} fill="#f2c29a" />
          <path d={hairPath(18)} fill="#3b2a20" />
          <ellipse cx="-6" cy="-21" rx="1.5" ry="2" fill="#2b2b2b" />
          <ellipse cx="6" cy="-21" rx="1.5" ry="2" fill="#2b2b2b" />
          <path d="M -6 -11 Q 0 -6 6 -11" stroke="#2b2b2b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>

        {/* child, nested against the mother */}
        <rect x="8" y="2" width="40" height="46" rx="20" fill={childColor} />
        <g transform="translate(30 -14) rotate(-8)">
          <g transform="translate(0 14)">
            <path d={headPath(13)} fill="#e3a570" />
            <path d={hairPath(13)} fill="#241c15" />
            <ellipse cx="-4.3" cy="-15.2" rx="1.2" ry="1.5" fill="#2b2b2b" />
            <ellipse cx="4.3" cy="-15.2" rx="1.2" ry="1.5" fill="#2b2b2b" />
            <path d="M -4.3 -7.9 Q 0 -4.3 4.3 -7.9" stroke="#2b2b2b" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </g>
        </g>

        {/* child's arm, wraps up around the mother */}
        <motion.path
          d="M 30 6 Q 8 12 -8 18"
          stroke={childColor}
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
          animate={active ? { pathLength: [0.85, 1, 0.85] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />

        {/* mother's near arm, closes the embrace over the child */}
        <motion.path
          d="M -6 -6 Q 30 -4 44 24"
          stroke={motherColor}
          strokeWidth="15"
          strokeLinecap="round"
          fill="none"
          animate={active ? { pathLength: [0.88, 1, 0.88] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </g>
    </svg>
  );
}

function KeepLearningScene({ active }: StorySceneIllustrationProps) {
  return (
    <svg viewBox={VIEW} className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Child smiling with books and homework, looking forward to a bright future">
      <defs>
        <linearGradient id="learnBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dff3ff" />
          <stop offset="100%" stopColor="#fff8e6" />
        </linearGradient>
        <radialGradient id="learnGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe999" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffe999" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-110" width="700" height="260" fill="url(#learnBg)" />
      <Sun cx={410} cy={44} r={22} active={active} />
      <Ground y={205} color="#d8ede2" />

      <motion.circle
        cx={196}
        cy={54}
        r={34}
        fill="url(#learnGlow)"
        animate={active ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : { opacity: 0.7 }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "196px 54px" }}
      />
      <motion.polygon
        points={starPoints(196, 54, 14, 6)}
        fill="#ffd166"
        animate={active ? { rotate: [0, 14, 0], scale: [1, 1.1, 1] } : undefined}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "196px 54px" }}
      />

      {active && (
        <motion.path
          d="M 60 205 A 150 150 0 0 1 360 205"
          stroke="#ff9f4a"
          strokeWidth="5"
          fill="none"
          opacity="0.55"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      )}
      <path d="M 72 205 A 138 138 0 0 1 348 205" stroke="#63c78a" strokeWidth="5" fill="none" opacity="0.45" />
      <path d="M 84 205 A 126 126 0 0 1 336 205" stroke="#4fa1ff" strokeWidth="5" fill="none" opacity="0.4" />

      <g transform="translate(150 150)">
        <rect x="0" y="20" width="34" height="46" rx="3" fill="#ff6b8b" transform="rotate(-8 0 40)" />
        <rect x="16" y="14" width="34" height="50" rx="3" fill="#4fa1ff" transform="rotate(4 0 40)" />
        <rect x="34" y="22" width="30" height="42" rx="3" fill="#63c78a" transform="rotate(-3 0 40)" />
      </g>

      <Figure x={260} y={150} height={100} skin="#c98a56" outfit="#ffcf5c" hair="#1f1f1f" active={active} />

      <g transform="translate(300 96)">
        <rect x="-16" y="-6" width="32" height="4" rx="2" fill="#a9835a" />
        <path d="M -16 -6 Q -16 -20 -2 -20 L -2 -6 Z" fill="#4fa1ff" />
        <path d="M 16 -6 Q 16 -20 2 -20 L 2 -6 Z" fill="#ff9f4a" />
      </g>

      <Sparkle x={332} y={80} active={active} delay={0.1} />
      <Sparkle x={352} y={110} size={5} active={active} delay={0.6} />
      <Sparkle x={318} y={120} size={4} active={active} delay={1.1} />
    </svg>
  );
}

export const STORY_SCENES: StoryScene[] = [
  {
    id: "school-morning",
    emoji: "🚏",
    title: "School Morning",
    caption: "The van arrives — a happy chat before the day begins.",
    duration: 6000,
    Illustration: SchoolMorningScene,
  },
  {
    id: "journey",
    emoji: "🚌",
    title: "Journey to School",
    caption: "Friends together, all smiles on the way to school.",
    duration: 6500,
    Illustration: JourneyScene,
  },
  {
    id: "exam-day",
    emoji: "📝",
    title: "Exam Day",
    caption: "Today is exam day — calm minds, best effort.",
    duration: 6000,
    Illustration: ExamDayScene,
  },
  {
    id: "ptm",
    emoji: "👩‍🏫",
    title: "Parent–Teacher Meeting",
    caption: "Teacher and parent, working together for progress.",
    duration: 6500,
    Illustration: PTMScene,
  },
  {
    id: "congratulations",
    emoji: "🎉",
    title: "Congratulations!",
    caption: "A proud hug for a great achievement.",
    duration: 7000,
    Illustration: CongratulationsScene,
  },
  {
    id: "keep-learning",
    emoji: "⭐",
    title: "Keep Learning",
    caption: "Keep Learning, Keep Growing!",
    duration: 6500,
    Illustration: KeepLearningScene,
  },
];
