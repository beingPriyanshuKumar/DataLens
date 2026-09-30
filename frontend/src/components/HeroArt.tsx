export default function HeroArt() {
  return (
    <svg
      viewBox="0 0 560 640"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <pattern id="hero-stipple" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" fill="var(--color-surface)" opacity="0.35" />
        </pattern>
      </defs>

      {/* Backdrop Shapes */}
      <ellipse cx="90" cy="530" rx="150" ry="120" fill="var(--color-red)" opacity="0.14" />
      <circle cx="470" cy="110" r="66" fill="none" stroke="var(--color-blue-pale)" strokeWidth="26" strokeDasharray="14 10" />
      <circle cx="490" cy="540" r="32" fill="none" stroke="var(--color-blue-pale)" strokeWidth="14" strokeDasharray="8 6" />
      <circle cx="70" cy="130" r="28" fill="none" stroke="var(--color-blue-pale)" strokeWidth="10" strokeDasharray="7 5" />

      {/* Thin Ink Arc */}
      <path d="M 80 290 Q 230 170 450 310" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeDasharray="4 4" />

      {/* Pipeline Quadrilateral Line */}
      <polygon points="120,240 280,175 425,290 245,365" fill="none" stroke="var(--color-line)" strokeWidth="1.5" />

      {/* Node Graph: 4 Rounded Squares */}
      <rect x="92" y="212" width="56" height="56" rx="14" fill="var(--color-ink)" transform="rotate(22 120 240)" />
      <rect x="252" y="147" width="56" height="56" rx="14" fill="var(--color-ink)" transform="rotate(28 280 175)" />
      <rect x="397" y="262" width="56" height="56" rx="14" fill="var(--color-ink)" transform="rotate(20 425 290)" />
      <rect x="217" y="337" width="56" height="56" rx="14" fill="var(--color-ink)" transform="rotate(26 245 365)" />

      {/* Filter: Triangle Pointing Down */}
      <polygon points="205,80 345,80 275,185" fill="var(--color-red)" />
      <polygon points="205,80 345,80 275,185" fill="url(#hero-stipple)" />

      {/* Toggle Pill with White Cutout */}
      <g transform="translate(255, 435) rotate(-16)">
        <rect x="-160" y="-60" width="320" height="120" rx="60" fill="var(--color-blue)" />
        <rect x="-160" y="-60" width="320" height="120" rx="60" fill="url(#hero-stipple)" />
        <circle cx="95" cy="0" r="44" fill="var(--color-surface)" />
      </g>

      {/* Cursor Arrow */}
      <path
        d="M 445 510 L 400 425 L 485 452 L 452 475 L 478 522 L 458 532 L 432 485 Z"
        fill="var(--color-ink)"
        stroke="var(--color-surface)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
