import type { SVGProps } from 'react'

/* Монохромные иконки в стиле lucide: stroke=currentColor, 1.5px, viewBox 24. */
const P: Record<string, string> = {
  overview: 'M3 12h4l3 8 4-16 3 8h4',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  bot: 'M12 3v3M7 9h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM9.5 13.5h.01M14.5 13.5h.01',
  folder: 'M3 7a2 2 0 0 1 2-2h3.6l1.8 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  key: 'M15 7a4 4 0 1 1-3.5 5.9L4 20.5V17l1.5-1.5H8l1-1v-1.5l1.5-1.5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L5 10.9a7 7 0 0 0 0 2.2L3 14.5l2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h5l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  close: 'M18 6 6 18M6 6l12 12',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alert: 'M12 3 2 20h20zM12 9v5M12 17.5h.01',
  check: 'M20 6 9 17l-5-5',
  cpu: 'M6 6h12v12H6zM9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2',
  disk: 'M4 6h16v12H4zM8 12h.01M12 12h.01M16 12h.01',
  memory: 'M4 8h16v8H4zM8 8V5M12 8V5M16 8V5M8 19v-3M12 19v-3M16 19v-3',
  terminal: 'M5 7l5 5-5 5M13 17h6',
  external: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
  edit: 'M4 20h4l10-10-4-4L4 16zM14 6l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M4 4l16 16M10 5.2A9.6 9.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-2.4 3.2M6.2 7.3A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 3.6-.7',
  layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  arrowRight: 'M4 12h15M13 6l6 6-6 6',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  git: 'M9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 17V7a2 2 0 1 1 4 0v10M15 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 17v-3a3 3 0 0 0-3-3h-3',
  github: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.4.5-.7 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-2 1-5 .5-5-2',
  zap: 'M13 2 4 14h6l-1 8 9-12h-6z',
  pin: 'M12 21v-6M8 4h8l-1 6 3 3H6l3-3z',
  download: 'M12 4v11M7 11l5 5 5-5M4 20h16',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
}

export type IconName = keyof typeof P

export function Icon({
  name,
  size = 15,
  ...rest
}: { name: IconName | string; size?: number } & SVGProps<SVGSVGElement>) {
  const d = P[name as string] ?? P.overview
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  )
}
