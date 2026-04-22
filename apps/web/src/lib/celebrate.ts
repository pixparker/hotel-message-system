import confetti from "canvas-confetti";

/**
 * A short, multi-stage confetti celebration suitable for "first success"
 * moments (device paired, campaign sent for the first time, etc.). Tuned to
 * feel festive but not disruptive — ~1.8s total, then cleans up.
 */
export function celebrate() {
  // Brand teal + warm gold anchor the palette; festive accents round it out.
  const colors = [
    "#14a77a", // brand-500
    "#0d8a64", // brand-600
    "#e49b0f", // accent-500
    "#fccf4d", // accent-300
    "#60a5fa", // sky-400
    "#f472b6", // pink-400
  ];

  // Big center burst — the "wow" moment.
  const bigBurst = (origin: { x: number; y: number }, angle: number) =>
    confetti({
      particleCount: 120,
      spread: 90,
      startVelocity: 45,
      angle,
      origin,
      colors,
      zIndex: 9999,
      scalar: 1.1,
    });

  bigBurst({ x: 0.5, y: 0.35 }, 90);

  // Left + right cannons re-fire the same big burst three more times,
  // staggered so the effect builds instead of landing all at once.
  const followUps = [250, 600, 950];
  for (const delay of followUps) {
    setTimeout(() => bigBurst({ x: 0, y: 0.75 }, 60), delay);
    setTimeout(() => bigBurst({ x: 1, y: 0.75 }, 120), delay);
  }
}
