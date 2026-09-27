interface NotraProps {
  className?: string;
}

/** Kolaria mark — cyan sphere avatar with neutral dark eyes. */
export function Kolaria({ className }: NotraProps) {
  return (
    <svg
      aria-label="Kolaria"
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient
          cx="38%"
          cy="30%"
          id="kolaria-sphere"
          r="85%"
        >
          <stop offset="0%" stopColor="#7df1fa" />
          <stop offset="55%" stopColor="#24d4df" />
          <stop offset="100%" stopColor="#15adba" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="120" r="114" fill="url(#kolaria-sphere)" />
      <rect fill="#111316" height="50" rx="10" width="20" x="82.5" y="88" />
      <rect fill="#111316" height="50" rx="10" width="20" x="137.5" y="88" />
    </svg>
  );
}
