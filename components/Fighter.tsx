"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";

export type Finisher =
  | "cross"
  | "hook"
  | "uppercut"
  | "kick"
  | "slap"
  | "elbow";

export interface FighterHandle {
  jab: () => void;
  heavy: (kind: Finisher) => void;
  hurt: () => void;
  reset: () => void;
}

type Target = SVGGElement | null;

/* Keep the letter knock-back and the fist on the same beat. TypeFight waits
   this long before it spawns the hit effect and the jab sound. */
export const JAB_CONTACT_MS = 68;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function play(
  target: Target,
  keyframes: Keyframe[],
  duration: number,
  easing = "cubic-bezier(.16,1,.3,1)",
) {
  if (!target) return;
  if (prefersReducedMotion()) {
    duration = Math.min(duration, 110);
  }
  target.getAnimations().forEach((animation) => animation.cancel());
  // The easing option on Element.animate() eases the whole timeline, which
  // compresses long keyframe sequences into their final segment. Apply the
  // easing per keyframe segment instead and keep the effect itself linear.
  const frames = keyframes.map((frame) => ({ easing, ...frame }));
  target.animate(frames, { duration, fill: "none", easing: "linear" });
}

const origin = (x: number, y: number): CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

/* The glove rim must sit on the strike line: 363 + 24 = 387, which is 7 units
   past the 380 wide viewBox. TypeFight relies on both numbers. */
const LEAD_GLOVE = { cx: 363, cy: 184, r: 24 };

/* Southpaw guard: lead (right) hand beside the jaw at (252, 123), rear (left)
   hand under the chin, both elbows down and tucked. The two wrappers hold this
   fold, so the per-letter jab can unfold them to the full reach (363, 184) and
   snap back tight to the face. */
const GUARD_UPPER = 22;
const GUARD_FORE = -162;
const guardUpper = `rotate(${GUARD_UPPER}deg)`;
const guardFore = `rotate(${GUARD_FORE}deg)`;

/* Body at rest: hunched forward over the lead foot, chin tucked, shoulders
   rolled ahead of the hips, weight on the bent rear leg. */
const TORSO =
  "M182 145 C164 150 155 168 157 191 C159 216 161 242 165 258 C169 272 179 281 191 281 C205 281 217 272 224 257 C233 235 239 206 241 181 C243 162 239 150 233 145 C218 135 197 135 182 145 Z";
const NECK = "M192 116 L220 114 L224 142 L188 142 Z";

/* Rear (left) leg sits behind the torso, knee bent forward and the heel
   lifted so the fighter stays on the ball of the foot. */
const REAR_THIGH = "M172 268 C162 292 154 316 150 338";
const REAR_SHIN = "M150 338 C138 364 124 390 116 410";
const REAR_SHOE = "M96 404 Q 126 425 156 433";
/* Lead (right) leg is planted forward with the knee bent. */
const LEAD_THIGH = "M216 268 C230 292 246 316 258 338";
const LEAD_SHIN = "M258 338 C260 364 260 392 260 416";
const LEAD_SHOE = "M244 421 Q 280 436 322 428";

/* Lead arm: shoulder -> elbow -> glove. Fully extended it lands on the strike
   line; folded it puts the glove beside the jaw. */
const LEAD_UPPER = "M232 142 C252 144 276 150 298 160";
const LEAD_FORE = "M298 160 C310 164 322 168 334 172";
/* Rear hand tucks under the chin, elbow down along the ribs. */
const REAR_UPPER = "M168 150 C167 170 171 188 179 201";
const REAR_FORE = "M179 201 C188 183 199 163 210 146";
const REAR_GLOVE = { cx: 210, cy: 146, r: 16 };

export const Fighter = forwardRef<FighterHandle, { className?: string }>(
  function Fighter({ className }, ref) {
    const root = useRef<SVGGElement>(null);
    const torso = useRef<SVGGElement>(null);
    const head = useRef<SVGGElement>(null);
    const rearArm = useRef<SVGGElement>(null);
    const jabUpper = useRef<SVGGElement>(null);
    const jabFore = useRef<SVGGElement>(null);
    const glovePulse = useRef<SVGGElement>(null);
    const glove = useRef<SVGGElement>(null);
    const palm = useRef<SVGGElement>(null);
    const jabTrail = useRef<SVGGElement>(null);
    const punchTrail = useRef<SVGGElement>(null);
    const rearLeg = useRef<SVGGElement>(null);
    const rearShin = useRef<SVGGElement>(null);
    const leadLeg = useRef<SVGGElement>(null);
    const leadShin = useRef<SVGGElement>(null);
    const leadFoot = useRef<SVGGElement>(null);
    const kickTrail = useRef<SVGGElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        jab() {
          // Unfold the guard wrappers all the way to the strike line, then
          // fold back to the face. 0/0 is the extended pose.
          play(
            jabUpper.current,
            [
              { transform: guardUpper },
              { transform: guardUpper, offset: 0.06 },
              { transform: "rotate(0deg)", offset: 0.34 },
              { transform: "rotate(-4deg)", offset: 0.46 },
              { transform: guardUpper },
            ],
            200,
            "cubic-bezier(.2,.9,.24,1)",
          );
          play(
            jabFore.current,
            [
              { transform: guardFore },
              { transform: guardFore, offset: 0.06 },
              { transform: "rotate(0deg)", offset: 0.34 },
              { transform: "rotate(5deg)", offset: 0.46 },
              { transform: guardFore },
            ],
            200,
            "cubic-bezier(.2,.9,.24,1)",
          );
          play(
            glovePulse.current,
            [
              { transform: "scale(1)" },
              { transform: "scale(1.06)", offset: 0.38 },
              { transform: "scale(1)" },
            ],
            210,
            "ease-out",
          );
          play(
            jabTrail.current,
            [
              { opacity: 0 },
              { opacity: 0.7, offset: 0.34 },
              { opacity: 0 },
            ],
            210,
            "ease-out",
          );
        },

        heavy(kind) {
          glovePulse.current?.getAnimations().forEach((a) => a.cancel());

          if (kind === "kick") {
            // Anticipation sinks the hips, then the lead leg whips up and the
            // guard retracts so the shin can own the strike line.
            play(
              root.current,
              [
                { transform: "translate(0, 0)" },
                { transform: "translate(-6px, 1px)", offset: 0.14 },
                { transform: "translate(24px, -10px)", offset: 0.36 },
                { transform: "translate(20px, -8px)", offset: 0.45 },
                { transform: "translate(8px, -2px)", offset: 0.64 },
                { transform: "translate(0, 0)" },
              ],
              640,
            );
            play(
              torso.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(7deg)", offset: 0.14 },
                { transform: "rotate(-13deg)", offset: 0.36 },
                { transform: "rotate(-11deg)", offset: 0.45 },
                { transform: "rotate(-4deg)", offset: 0.66 },
                { transform: "rotate(0deg)" },
              ],
              640,
            );
            play(
              head.current,
              [
                { transform: "translate(0, 0) rotate(0deg)" },
                {
                  transform: "translate(-3px, 3px) rotate(4deg)",
                  offset: 0.16,
                },
                {
                  transform: "translate(-10px, 3px) rotate(-6deg)",
                  offset: 0.38,
                },
                {
                  transform: "translate(-6px, 2px) rotate(-4deg)",
                  offset: 0.52,
                },
                { transform: "translate(0, 0) rotate(0deg)" },
              ],
              640,
            );
            play(
              leadLeg.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(9deg)", offset: 0.14 },
                { transform: "rotate(-132deg)", offset: 0.36 },
                { transform: "rotate(-136deg)", offset: 0.45 },
                { transform: "rotate(-40deg)", offset: 0.66 },
                { transform: "rotate(-6deg)", offset: 0.82 },
                { transform: "rotate(0deg)" },
              ],
              640,
            );
            play(
              leadShin.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(24deg)", offset: 0.14 },
                { transform: "rotate(46deg)", offset: 0.36 },
                { transform: "rotate(48deg)", offset: 0.45 },
                { transform: "rotate(20deg)", offset: 0.66 },
                { transform: "rotate(6deg)", offset: 0.82 },
                { transform: "rotate(0deg)" },
              ],
              640,
            );
            play(
              leadFoot.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-16deg)", offset: 0.14 },
                { transform: "rotate(88deg)", offset: 0.36 },
                { transform: "rotate(90deg)", offset: 0.45 },
                { transform: "rotate(30deg)", offset: 0.66 },
                { transform: "rotate(0deg)" },
              ],
              640,
            );
            play(
              rearArm.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-12deg)", offset: 0.22 },
                { transform: "rotate(-15deg)", offset: 0.42 },
                { transform: "rotate(-5deg)", offset: 0.64 },
                { transform: "rotate(0deg)" },
              ],
              620,
            );
            play(
              jabUpper.current,
              [
                { transform: guardUpper },
                { transform: "rotate(52deg)", offset: 0.2 },
                { transform: "rotate(60deg)", offset: 0.38 },
                { transform: "rotate(38deg)", offset: 0.6 },
                { transform: guardUpper },
              ],
              620,
            );
            play(
              jabFore.current,
              [
                { transform: guardFore },
                { transform: "rotate(-176deg)", offset: 0.2 },
                { transform: "rotate(-184deg)", offset: 0.38 },
                { transform: "rotate(-168deg)", offset: 0.6 },
                { transform: guardFore },
              ],
              620,
            );
            play(
              rearLeg.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(6deg)", offset: 0.18 },
                { transform: "rotate(9deg)", offset: 0.38 },
                { transform: "rotate(2deg)", offset: 0.6 },
                { transform: "rotate(0deg)" },
              ],
              640,
            );
            play(
              rearShin.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-6deg)", offset: 0.18 },
                { transform: "rotate(-10deg)", offset: 0.38 },
                { transform: "rotate(-2deg)", offset: 0.6 },
                { transform: "rotate(0deg)" },
              ],
              640,
            );
            play(
              kickTrail.current,
              [
                { opacity: 0 },
                { opacity: 0.3, offset: 0.18 },
                { opacity: 1, offset: 0.4 },
                { opacity: 0.55, offset: 0.5 },
                { opacity: 0 },
              ],
              620,
              "ease-out",
            );
            return;
          }

          if (kind === "hook") {
            play(
              root.current,
              [
                { transform: "translate(0, 0)" },
                { transform: "translate(-6px, 0)", offset: 0.14 },
                { transform: "translate(0, 0)", offset: 0.32 },
                { transform: "translate(8px, 0)", offset: 0.46 },
                { transform: "translate(4px, 0)", offset: 0.62 },
                { transform: "translate(0, 0)" },
              ],
              470,
            );
            play(
              torso.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-11deg)", offset: 0.14 },
                { transform: "rotate(0deg)", offset: 0.32 },
                { transform: "rotate(0deg)", offset: 0.35 },
                { transform: "rotate(9deg)", offset: 0.46 },
                { transform: "rotate(4deg)", offset: 0.62 },
                { transform: "rotate(2deg)", offset: 0.76 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            play(
              jabUpper.current,
              [
                { transform: guardUpper },
                { transform: "rotate(54deg)", offset: 0.14 },
                { transform: "rotate(0deg)", offset: 0.32 },
                { transform: "rotate(0deg)", offset: 0.35 },
                { transform: "rotate(-6deg)", offset: 0.46 },
                { transform: guardUpper },
              ],
              460,
            );
            play(
              jabFore.current,
              [
                { transform: guardFore },
                { transform: "rotate(-176deg)", offset: 0.14 },
                { transform: "rotate(0deg)", offset: 0.32 },
                { transform: "rotate(0deg)", offset: 0.35 },
                { transform: "rotate(8deg)", offset: 0.46 },
                { transform: guardFore },
              ],
              460,
            );
            play(
              rearArm.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(8deg)", offset: 0.18 },
                { transform: "rotate(-9deg)", offset: 0.34 },
                { transform: "rotate(-3deg)", offset: 0.55 },
                { transform: "rotate(0deg)" },
              ],
              450,
            );
            play(
              head.current,
              [
                { transform: "translate(0, 0) rotate(0deg)" },
                {
                  transform: "translate(-4px, 1px) rotate(-4deg)",
                  offset: 0.18,
                },
                {
                  transform: "translate(5px, 1px) rotate(3deg)",
                  offset: 0.36,
                },
                { transform: "translate(1px, 0) rotate(1deg)", offset: 0.58 },
                { transform: "translate(0, 0) rotate(0deg)" },
              ],
              470,
            );
            play(
              rearLeg.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-3deg)", offset: 0.18 },
                { transform: "rotate(2deg)", offset: 0.38 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            play(
              rearShin.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(2deg)", offset: 0.18 },
                { transform: "rotate(-1.5deg)", offset: 0.38 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            play(
              punchTrail.current,
              [
                { opacity: 0 },
                { opacity: 0.2, offset: 0.28 },
                { opacity: 0.95, offset: 0.38 },
                { opacity: 0.5, offset: 0.5 },
                { opacity: 0 },
              ],
              440,
            );
            return;
          }

          if (kind === "uppercut") {
            // A true uppercut: dip and load the fist low, then drive up behind
            // a folded arm so the elbow stays under the fist at contact.
            play(
              root.current,
              [
                { transform: "translate(0, 0)" },
                { transform: "translate(-3px, 10px)", offset: 0.18 },
                { transform: "translate(40px, 4px)", offset: 0.34 },
                { transform: "translate(40px, 4px)", offset: 0.40 },
                { transform: "translate(30px, -3px)", offset: 0.50 },
                { transform: "translate(10px, -1px)", offset: 0.68 },
                { transform: "translate(0, 0)" },
              ],
              500,
            );
            play(
              torso.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(8deg)", offset: 0.18 },
                { transform: "rotate(0deg)", offset: 0.34 },
                { transform: "rotate(0deg)", offset: 0.40 },
                { transform: "rotate(-7deg)", offset: 0.50 },
                { transform: "rotate(-2deg)", offset: 0.68 },
                { transform: "rotate(0deg)" },
              ],
              500,
            );
            play(
              jabUpper.current,
              [
                { transform: guardUpper },
                { transform: "rotate(70deg)", offset: 0.18 },
                { transform: "rotate(52deg)", offset: 0.34 },
                { transform: "rotate(52deg)", offset: 0.40 },
                { transform: "rotate(8deg)", offset: 0.52 },
                { transform: guardUpper },
              ],
              490,
            );
            play(
              jabFore.current,
              [
                { transform: guardFore },
                { transform: "rotate(-70deg)", offset: 0.18 },
                { transform: "rotate(-93deg)", offset: 0.34 },
                { transform: "rotate(-93deg)", offset: 0.40 },
                { transform: "rotate(-40deg)", offset: 0.52 },
                { transform: guardFore },
              ],
              490,
            );
            play(
              head.current,
              [
                { transform: "translate(0, 0) rotate(0deg)" },
                { transform: "translate(2px, 5px) rotate(2deg)", offset: 0.18 },
                {
                  transform: "translate(3px, -4px) rotate(-4deg)",
                  offset: 0.36,
                },
                { transform: "translate(1px, -2px) rotate(-1deg)", offset: 0.6 },
                { transform: "translate(0, 0) rotate(0deg)" },
              ],
              500,
            );
            play(
              rearArm.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-6deg)", offset: 0.2 },
                { transform: "rotate(6deg)", offset: 0.4 },
                { transform: "rotate(0deg)" },
              ],
              480,
            );
            play(
              rearLeg.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(6deg)", offset: 0.18 },
                { transform: "rotate(-4deg)", offset: 0.36 },
                { transform: "rotate(-1deg)", offset: 0.5 },
                { transform: "rotate(0deg)" },
              ],
              500,
            );
            play(
              leadLeg.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(5deg)", offset: 0.18 },
                { transform: "rotate(-8deg)", offset: 0.34 },
                { transform: "rotate(-4deg)", offset: 0.46 },
                { transform: "rotate(0deg)" },
              ],
              500,
            );
            play(
              leadShin.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-7deg)", offset: 0.18 },
                { transform: "rotate(12deg)", offset: 0.34 },
                { transform: "rotate(6deg)", offset: 0.46 },
                { transform: "rotate(0deg)" },
              ],
              500,
            );
            play(
              leadFoot.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-8deg)", offset: 0.18 },
                { transform: "rotate(16deg)", offset: 0.34 },
                { transform: "rotate(6deg)", offset: 0.46 },
                { transform: "rotate(0deg)" },
              ],
              500,
            );
            play(
              punchTrail.current,
              [
                { opacity: 0 },
                { opacity: 0.2, offset: 0.2 },
                { opacity: 0.3, offset: 0.3 },
                { opacity: 1, offset: 0.34 },
                { opacity: 0.55, offset: 0.46 },
                { opacity: 0 },
              ],
              480,
            );
            return;
          }

          if (kind === "slap") {
            // The glove fades out for the open palm, then both come back as the
            // arm returns to guard.
            play(
              glove.current,
              [
                { opacity: 1 },
                { opacity: 1, offset: 0.16 },
                { opacity: 0, offset: 0.22 },
                { opacity: 0, offset: 0.68 },
                { opacity: 1, offset: 0.82 },
                { opacity: 1 },
              ],
              420,
              "ease-out",
            );
            play(
              palm.current,
              [
                { opacity: 0 },
                { opacity: 0, offset: 0.16 },
                { opacity: 1, offset: 0.22 },
                { opacity: 1, offset: 0.68 },
                { opacity: 0, offset: 0.82 },
                { opacity: 0 },
              ],
              420,
              "ease-out",
            );
            play(
              root.current,
              [
                { transform: "translate(0, 0)" },
                { transform: "translate(-4px, 0)", offset: 0.15 },
                { transform: "translate(0, 0)", offset: 0.3 },
                { transform: "translate(0, 0)", offset: 0.33 },
                { transform: "translate(10px, -1px)", offset: 0.42 },
                { transform: "translate(6px, 0)", offset: 0.55 },
                { transform: "translate(0, 0)" },
              ],
              420,
            );
            play(
              torso.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-7deg)", offset: 0.15 },
                { transform: "rotate(0deg)", offset: 0.3 },
                { transform: "rotate(0deg)", offset: 0.33 },
                { transform: "rotate(7deg)", offset: 0.42 },
                { transform: "rotate(4deg)", offset: 0.55 },
                { transform: "rotate(0deg)" },
              ],
              420,
            );
            play(
              jabUpper.current,
              [
                { transform: guardUpper },
                { transform: "rotate(54deg)", offset: 0.15 },
                { transform: "rotate(0deg)", offset: 0.3 },
                { transform: "rotate(0deg)", offset: 0.33 },
                { transform: "rotate(-5deg)", offset: 0.42 },
                { transform: guardUpper },
              ],
              410,
            );
            play(
              jabFore.current,
              [
                { transform: guardFore },
                { transform: "rotate(-176deg)", offset: 0.15 },
                { transform: "rotate(0deg)", offset: 0.3 },
                { transform: "rotate(0deg)", offset: 0.33 },
                { transform: "rotate(8deg)", offset: 0.42 },
                { transform: guardFore },
              ],
              410,
            );
            play(
              head.current,
              [
                { transform: "translate(0, 0) rotate(0deg)" },
                { transform: "translate(-3px, 1px) rotate(-3deg)", offset: 0.18 },
                { transform: "translate(4px, 0) rotate(3deg)", offset: 0.34 },
                { transform: "translate(0, 0) rotate(0deg)" },
              ],
              420,
            );
            play(
              rearArm.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(6deg)", offset: 0.2 },
                { transform: "rotate(-6deg)", offset: 0.36 },
                { transform: "rotate(0deg)" },
              ],
              410,
            );
            play(
              punchTrail.current,
              [
                { opacity: 0 },
                { opacity: 0.3, offset: 0.26 },
                { opacity: 0.85, offset: 0.34 },
                { opacity: 0.4, offset: 0.46 },
                { opacity: 0 },
              ],
              400,
            );
            return;
          }

          if (kind === "elbow") {
            // A lunging elbow: the fighter steps in behind a folded forearm so
            // the point of the elbow lands on the word. Contact is later than
            // the punches (offset .38) because the step has to travel.
            play(
              root.current,
              [
                { transform: "translate(0, 0)" },
                { transform: "translate(-6px, 1px)", offset: 0.12 },
                { transform: "translate(18px, 3px)", offset: 0.26 },
                { transform: "translate(61px, 4px)", offset: 0.38 },
                { transform: "translate(61px, 4px)", offset: 0.44 },
                { transform: "translate(55px, 2px)", offset: 0.52 },
                { transform: "translate(18px, 0)", offset: 0.72 },
                { transform: "translate(0, 0)" },
              ],
              470,
            );
            play(
              torso.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-8deg)", offset: 0.12 },
                { transform: "rotate(2deg)", offset: 0.26 },
                { transform: "rotate(8deg)", offset: 0.38 },
                { transform: "rotate(8deg)", offset: 0.44 },
                { transform: "rotate(10deg)", offset: 0.58 },
                { transform: "rotate(3deg)", offset: 0.72 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            play(
              jabUpper.current,
              [
                { transform: guardUpper },
                { transform: "rotate(56deg)", offset: 0.12 },
                { transform: "rotate(20deg)", offset: 0.26 },
                { transform: "rotate(7deg)", offset: 0.38 },
                { transform: "rotate(7deg)", offset: 0.44 },
                { transform: guardUpper },
              ],
              460,
            );
            play(
              jabFore.current,
              [
                { transform: guardFore },
                { transform: "rotate(-180deg)", offset: 0.12 },
                { transform: "rotate(-142deg)", offset: 0.26 },
                { transform: "rotate(-150deg)", offset: 0.38 },
                { transform: "rotate(-150deg)", offset: 0.44 },
                { transform: guardFore },
              ],
              460,
            );
            play(
              head.current,
              [
                { transform: "translate(0, 0) rotate(0deg)" },
                { transform: "translate(-4px, 0) rotate(-3deg)", offset: 0.12 },
                { transform: "translate(3px, 1px) rotate(3deg)", offset: 0.3 },
                { transform: "translate(4px, 1px) rotate(4deg)", offset: 0.38 },
                { transform: "translate(2px, 0) rotate(2deg)", offset: 0.52 },
                { transform: "translate(0, 0) rotate(0deg)" },
              ],
              470,
            );
            play(
              rearArm.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(8deg)", offset: 0.12 },
                { transform: "rotate(-10deg)", offset: 0.3 },
                { transform: "rotate(-3deg)", offset: 0.48 },
                { transform: "rotate(0deg)" },
              ],
              450,
            );
            play(
              rearLeg.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-4deg)", offset: 0.14 },
                { transform: "rotate(3deg)", offset: 0.34 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            play(
              leadLeg.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(4deg)", offset: 0.14 },
                { transform: "rotate(-11deg)", offset: 0.30 },
                { transform: "rotate(-7deg)", offset: 0.40 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            play(
              leadShin.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-6deg)", offset: 0.14 },
                { transform: "rotate(14deg)", offset: 0.30 },
                { transform: "rotate(8deg)", offset: 0.40 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            play(
              leadFoot.current,
              [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-8deg)", offset: 0.14 },
                { transform: "rotate(18deg)", offset: 0.30 },
                { transform: "rotate(10deg)", offset: 0.40 },
                { transform: "rotate(0deg)" },
              ],
              470,
            );
            return;
          }

          // Cross: the lead fist drives through the line while the hips and the
          // rear foot pivot behind it.
          play(
            root.current,
            [
              { transform: "translate(0, 0)" },
              { transform: "translate(-5px, 1px)", offset: 0.15 },
              { transform: "translate(0, 0)", offset: 0.34 },
              { transform: "translate(0, 0)", offset: 0.37 },
              { transform: "translate(12px, -1px)", offset: 0.47 },
              { transform: "translate(5px, 0)", offset: 0.64 },
              { transform: "translate(0, 0)" },
            ],
            430,
          );
          play(
            torso.current,
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(-6deg)", offset: 0.15 },
              { transform: "rotate(0deg)", offset: 0.34 },
              { transform: "rotate(0deg)", offset: 0.37 },
              { transform: "rotate(7deg)", offset: 0.47 },
              { transform: "rotate(3deg)", offset: 0.64 },
              { transform: "rotate(0deg)" },
            ],
            430,
          );
          play(
            jabUpper.current,
            [
              { transform: guardUpper },
              { transform: "rotate(50deg)", offset: 0.15 },
              { transform: "rotate(0deg)", offset: 0.34 },
              { transform: "rotate(0deg)", offset: 0.37 },
              { transform: "rotate(-6deg)", offset: 0.47 },
              { transform: guardUpper },
            ],
            420,
          );
          play(
            jabFore.current,
            [
              { transform: guardFore },
              { transform: "rotate(-184deg)", offset: 0.15 },
              { transform: "rotate(0deg)", offset: 0.34 },
              { transform: "rotate(0deg)", offset: 0.37 },
              { transform: "rotate(8deg)", offset: 0.47 },
              { transform: guardFore },
            ],
            420,
          );
          play(
            rearArm.current,
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(-8deg)", offset: 0.18 },
              { transform: "rotate(5deg)", offset: 0.38 },
              { transform: "rotate(2deg)", offset: 0.55 },
              { transform: "rotate(0deg)" },
            ],
            420,
          );
          play(
            head.current,
            [
              { transform: "translate(0, 0) rotate(0deg)" },
              {
                transform: "translate(-3px, 2px) rotate(-4deg)",
                offset: 0.18,
              },
              { transform: "translate(4px, 1px) rotate(3deg)", offset: 0.38 },
              { transform: "translate(1px, 0) rotate(1deg)", offset: 0.6 },
              { transform: "translate(0, 0) rotate(0deg)" },
            ],
            430,
          );
          play(
            rearLeg.current,
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(-2.5deg)", offset: 0.18 },
              { transform: "rotate(1.5deg)", offset: 0.4 },
              { transform: "rotate(0deg)" },
            ],
            430,
          );
          play(
            rearShin.current,
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(1.5deg)", offset: 0.18 },
              { transform: "rotate(-1deg)", offset: 0.4 },
              { transform: "rotate(0deg)" },
            ],
            430,
          );
          play(
            punchTrail.current,
            [
              { opacity: 0 },
              { opacity: 0.2, offset: 0.3 },
              { opacity: 0.95, offset: 0.37 },
              { opacity: 0.5, offset: 0.5 },
              { opacity: 0 },
            ],
            410,
          );
        },

        hurt() {
          play(
            head.current,
            [
              { transform: "translate(0, 0) rotate(0deg)" },
              {
                transform: "translate(-9px, 2px) rotate(-5deg)",
                offset: 0.2,
              },
              { transform: "translate(4px, 1px) rotate(2deg)", offset: 0.42 },
              { transform: "translate(-2px, 0) rotate(-1deg)", offset: 0.62 },
              { transform: "translate(0, 0) rotate(0deg)" },
            ],
            320,
            "ease-out",
          );
          play(
            torso.current,
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(-3deg)", offset: 0.22 },
              { transform: "rotate(1deg)", offset: 0.5 },
              { transform: "rotate(0deg)" },
            ],
            300,
            "ease-out",
          );
          play(
            jabUpper.current,
            [
              { transform: guardUpper },
              { transform: "rotate(42deg)", offset: 0.22 },
              { transform: guardUpper },
            ],
            280,
          );
          play(
            jabFore.current,
            [
              { transform: guardFore },
              { transform: "rotate(-158deg)", offset: 0.22 },
              { transform: guardFore },
            ],
            280,
          );
          play(
            rearArm.current,
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(-8deg)", offset: 0.2 },
              { transform: "rotate(0deg)" },
            ],
            280,
          );
        },

        reset() {
          [
            root,
            torso,
            head,
            rearArm,
            jabUpper,
            jabFore,
            glovePulse,
            glove,
            palm,
            jabTrail,
            punchTrail,
            rearLeg,
            rearShin,
            leadLeg,
            leadShin,
            leadFoot,
            kickTrail,
          ].forEach((element) => {
            element.current?.getAnimations().forEach((a) => a.cancel());
          });
        },
      }),
      [],
    );

    return (
      <div className={`fighter ${className ?? ""}`} aria-hidden="true">
        <div className="fighter-breathe">
          <svg
            className="fighter-svg"
            viewBox="0 0 380 460"
            preserveAspectRatio="xMaxYMax meet"
            focusable="false"
          >
            <defs>
              {/* One outline per limb: dilating the composited limb shape keeps
                  joints seamless while still separating it from the torso. */}
              <filter
                id="limb-outline"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feMorphology
                  in="SourceAlpha"
                  operator="dilate"
                  radius="2.8"
                  result="expanded"
                />
                <feFlood floodColor="#0f1115" result="ink" />
                <feComposite
                  in="ink"
                  in2="expanded"
                  operator="in"
                  result="outline"
                />
                <feMerge>
                  <feMergeNode in="outline" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <ellipse
              className="fighter-shadow"
              cx="206"
              cy="446"
              rx="150"
              ry="12"
            />

            <g ref={root}>
              {/* rear leg stays behind the torso */}
              <g
                ref={rearLeg}
                data-part="rear-leg"
                style={origin(172, 268)}
                filter="url(#limb-outline)"
              >
                <path className="limb" d={REAR_THIGH} />
                <g ref={rearShin} data-part="rear-shin" style={origin(150, 338)}>
                  <path className="limb" d={REAR_SHIN} />
                  <path className="shoe" d={REAR_SHOE} />
                </g>
              </g>

              <g ref={torso} data-part="torso" style={origin(196, 281)}>
                <path className="shape-halo" d={NECK} />
                <path className="shape" d={NECK} />
                <path className="shape-halo" d={TORSO} />
                <path className="shape" d={TORSO} />

                {/* neutral face: dot eyes and a nose only, chin tucked */}
                <g ref={head} data-part="head" style={origin(208, 122)}>
                  <circle className="shape-halo" cx="208" cy="92" r="30" />
                  <circle className="shape" cx="208" cy="92" r="30" />
                  <circle className="shape-halo" cx="178" cy="100" r="9" />
                  <circle className="shape" cx="178" cy="100" r="9" />
                  <ellipse className="face-eye" cx="198" cy="88" rx="3.6" ry="4.8" />
                  <ellipse className="face-eye" cx="224" cy="87" rx="3.6" ry="4.8" />
                  <path className="face-nose" d="M207 96 C204 101 205 105 210 106" />
                </g>

                {/* rear hand under the chin, elbow down the ribs */}
                <g
                  ref={rearArm}
                  data-part="rear-arm"
                  style={origin(168, 150)}
                  filter="url(#limb-outline)"
                >
                  <path className="limb" d={REAR_UPPER} />
                  <path className="limb" d={REAR_FORE} />
                  <circle
                    className="glove"
                    cx={REAR_GLOVE.cx}
                    cy={REAR_GLOVE.cy}
                    r={REAR_GLOVE.r}
                  />
                  <path
                    className="glove-seam"
                    d="M196 140 C202 148 210 151 218 147"
                  />
                </g>

                {/* lead arm: shoulder -> elbow -> glove. The wrappers carry the
                    guard fold; 0/0 is the full extension on the strike line. */}
                <g data-part="lead-arm" filter="url(#limb-outline)">
                  <g
                    ref={jabUpper}
                    data-part="jab-upper"
                    style={{ ...origin(232, 142), transform: guardUpper }}
                  >
                    <path className="limb" d={LEAD_UPPER} />
                    <g
                      ref={jabFore}
                      data-part="lead-forearm"
                      style={{ ...origin(298, 160), transform: guardFore }}
                    >
                      <g ref={jabTrail} className="punch-trail">
                        <path d="M342 159 L373 147" />
                        <path d="M348 184 L381 181" />
                        <path d="M342 208 L371 217" />
                      </g>
                      <g
                        ref={punchTrail}
                        className="punch-trail punch-trail-heavy"
                      >
                        <path d="M335 152 L372 136" />
                        <path d="M347 166 L386 156" />
                        <path d="M351 184 L390 182" />
                        <path d="M347 202 L386 212" />
                        <path d="M336 216 L371 232" />
                      </g>
                      <path className="limb" d={LEAD_FORE} />
                      <g
                        ref={glovePulse}
                        style={origin(LEAD_GLOVE.cx, LEAD_GLOVE.cy)}
                      >
                        <g ref={glove} className="glove-group">
                          <circle
                            className="glove"
                            cx={LEAD_GLOVE.cx}
                            cy={LEAD_GLOVE.cy}
                            r={LEAD_GLOVE.r}
                          />
                          <path
                            className="glove-seam"
                            d="M342 200 C349 205 359 206 367 201"
                          />
                          <path
                            className="glove-detail"
                            d="M368 172 C375 175 377 182 374 188"
                          />
                        </g>
                        <g ref={palm} className="palm">
                          <ellipse
                            className="palm-pad"
                            cx="352"
                            cy="184"
                            rx="15"
                            ry="18"
                          />
                          <path className="palm-finger" d="M358 170 L379 164" />
                          <path className="palm-finger" d="M362 177 L385 174" />
                          <path className="palm-finger" d="M363 185 L387 184" />
                          <path className="palm-finger" d="M360 193 L382 199" />
                          <path className="palm-finger" d="M345 198 L361 207" />
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              </g>

              {/* lead leg is drawn last so a raised kick stays readable */}
              <g
                ref={leadLeg}
                data-part="lead-leg"
                style={origin(216, 268)}
                filter="url(#limb-outline)"
              >
                <path className="limb" d={LEAD_THIGH} />
                <g ref={leadShin} data-part="lead-shin" style={origin(258, 338)}>
                  <path className="limb" d={LEAD_SHIN} />
                  <g ref={leadFoot} data-part="lead-foot" style={origin(260, 416)}>
                    <path className="shoe" d={LEAD_SHOE} />
                  </g>
                </g>
              </g>

              <g ref={kickTrail} className="kick-trail">
                <path d="M236 250 C270 220 306 190 342 178" />
                <path d="M254 268 C290 236 322 204 352 192" />
                <path d="M272 284 C306 252 334 218 360 202" />
                <path d="M220 226 C260 206 300 186 338 172" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    );
  },
);
