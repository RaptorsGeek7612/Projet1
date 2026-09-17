export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 2 28 8v10.5C28 25 22.5 29 16 30 9.5 29 4 25 4 18.5V8L16 2Z"
        fill="var(--accent)"
        fillOpacity="0.14"
        stroke="var(--accent)"
        strokeWidth="1.4"
      />
      <path
        d="M11 16.2 14.6 19.8 21.5 12.5"
        stroke="var(--accent-2)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
