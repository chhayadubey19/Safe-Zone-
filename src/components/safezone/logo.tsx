import { cn } from "@/lib/utils";

/**
 * SafeZone brand mark — clean SVG recreation of the uploaded logo:
 * a deep-blue gradient shield with a white location pin, and the green
 * arc sweeping around its base. Paired with the wordmark "Safe"Zone
 * (#1E3A5F / #16A34A) wherever the full logo renders.
 *
 * Pure SVG — no raster asset, scales crisply at any size, safe for SSR.
 */
export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="SafeZone" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="sz-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E3A8A" />
          <stop offset="1" stopColor="#0077E2" />
        </linearGradient>
        <linearGradient id="sz-arc" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0D9488" />
          <stop offset="1" stopColor="#18AB7F" />
        </linearGradient>
      </defs>
      {/* green arc — drawn first so it peeks around the shield's base */}
      <path
        d="M6 36 C9 54 33 63 58 47"
        fill="none"
        stroke="url(#sz-arc)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* shield */}
      <path
        d="M32 4.5 L54 11.5 V28 C54 42.5 45 53 32 59.5 C19 53 10 42.5 10 28 V11.5 Z"
        fill="url(#sz-shield)"
      />
      {/* white location pin */}
      <path
        d="M32 13.5 C26.6 13.5 22.3 17.8 22.3 23.1 C22.3 30.4 32 40 32 40 C32 40 41.7 30.4 41.7 23.1 C41.7 17.8 37.4 13.5 32 13.5 Z"
        fill="#FFFFFF"
      />
      <circle cx="32" cy="23.1" r="4.2" fill="#1E3A8A" />
    </svg>
  );
}

/**
 * Full lockup: shield mark + "Safe"Zone wordmark (navy / brand green).
 * Used in the header; clickable wrapping is left to the call site.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight", className)}>
      <span className="text-[#1E3A5F]">Safe</span>
      <span className="text-[#16A34A]">Zone</span>
    </span>
  );
}
