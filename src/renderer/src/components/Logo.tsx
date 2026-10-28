export function Logo({ size = 30 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="logo-gradient" x1="4" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="logo-shine" x1="8" y1="4" x2="22" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-gradient)" />
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="white" strokeOpacity="0.18" />
      <path d="M12.4 9.9c0-1 1.1-1.6 2-1.1l9.2 5.6c.8.5.8 1.7 0 2.2l-9.2 5.6c-.9.5-2-.1-2-1.1V9.9Z" fill="white" fillOpacity="0.94" />
      <path d="M9 10.5v11" stroke="white" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      <path d="M5.5 8.5c2.5 1.4 2.5 13.6 0 15" stroke="url(#logo-shine)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
