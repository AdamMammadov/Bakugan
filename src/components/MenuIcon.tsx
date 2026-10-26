/** Line icons for the main menu tiles (24 × 24, drawn with the current text colour). */
const PATHS = {
  brawl: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  bakugan: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h6m6 0h6" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  events: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4m-4 3v4m-3 3h6" />
    </>
  ),
  pass: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z" />,
  shop: (
    <>
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  inventory: (
    <>
      <rect x="5" y="7" width="14" height="14" rx="3" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2M5 13h14m-8 0v2h2v-2" />
    </>
  ),
  rankings: <path d="M3 21h18M5 21v-7h4v7m1 0V8h4v13m1 0v-5h4v5" />,
  clans: (
    <>
      <path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  friends: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7m2 2a7 7 0 0 1 4 6.5" />
    </>
  ),
  live: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4m8.4-8.4a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  encyclopedia: (
    <>
      <path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" />
      <path d="M5 20a2 2 0 0 0 2 1h12v-3M9 7h6" />
    </>
  ),
  showroom: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  characters: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 8v7m-5-4h10M9 22l3-7 3 7" />
    </>
  ),
  switch: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="m9 5 7 7-7 7" />,
}

export type MenuIconName = keyof typeof PATHS

export function MenuIcon({ name, size = 22, className }: { name: MenuIconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
