type MaskMotifProps = {
  className?: string;
};

/**
 * The surreal poster mask that anchors the whole art direction: a ritual
 * festival mask rendered as thin electric linework so it reads as a screen
 * print behind the type rather than an illustration competing with it.
 */
export function MaskMotif({ className }: MaskMotifProps) {
  return (
    <svg
      viewBox="0 0 400 620"
      fill="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="maskLine" x1="200" y1="40" x2="200" y2="600">
          <stop offset="0%" stopColor="#9cc4ff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#3d82ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#6b3bff" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="maskFill" x1="200" y1="60" x2="200" y2="560">
          <stop offset="0%" stopColor="#0d2f9e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#030308" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="eyeGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#55e6ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#55e6ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g stroke="url(#maskLine)" strokeWidth="1.1">
        <circle cx="200" cy="300" r="172" strokeOpacity="0.28" />
        <circle
          cx="200"
          cy="300"
          r="196"
          strokeOpacity="0.2"
          strokeDasharray="2 9"
        />
        <circle
          cx="200"
          cy="300"
          r="228"
          strokeOpacity="0.14"
          strokeDasharray="24 16"
        />
      </g>

      <g stroke="url(#maskLine)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M200 22 L200 62" strokeOpacity="0.7" />
        <path d="M136 42 L152 78" strokeOpacity="0.6" />
        <path d="M264 42 L248 78" strokeOpacity="0.6" />
        <path d="M84 84 L110 116" strokeOpacity="0.45" />
        <path d="M316 84 L290 116" strokeOpacity="0.45" />
      </g>

      <path
        d="M200 64 C302 64 352 156 352 268 C352 400 280 570 200 570 C120 570 48 400 48 268 C48 156 98 64 200 64 Z"
        fill="url(#maskFill)"
        stroke="url(#maskLine)"
        strokeWidth="2"
      />
      <path
        d="M200 96 C286 96 324 176 324 270 C324 388 262 538 200 538 C138 538 76 388 76 270 C76 176 114 96 200 96 Z"
        stroke="url(#maskLine)"
        strokeWidth="1"
        strokeOpacity="0.55"
      />

      <ellipse cx="200" cy="170" rx="46" ry="46" fill="url(#eyeGlow)" opacity="0.5" />
      <path
        d="M200 128 C216 148 216 186 200 206 C184 186 184 148 200 128 Z"
        stroke="url(#maskLine)"
        strokeWidth="1.8"
        fill="#030308"
        fillOpacity="0.5"
      />
      <circle cx="200" cy="167" r="6" fill="#a5d8ff" opacity="0.9" />

      <ellipse cx="146" cy="286" rx="52" ry="34" fill="url(#eyeGlow)" opacity="0.42" />
      <ellipse cx="254" cy="286" rx="52" ry="34" fill="url(#eyeGlow)" opacity="0.42" />
      <path
        d="M100 288 C124 252 176 250 194 282 C176 316 124 320 100 288 Z"
        stroke="url(#maskLine)"
        strokeWidth="2"
        fill="#030308"
        fillOpacity="0.65"
      />
      <path
        d="M300 288 C276 252 224 250 206 282 C224 316 276 320 300 288 Z"
        stroke="url(#maskLine)"
        strokeWidth="2"
        fill="#030308"
        fillOpacity="0.65"
      />
      <circle cx="148" cy="284" r="10" fill="#e8f3ff" opacity="0.85" />
      <circle cx="252" cy="284" r="10" fill="#e8f3ff" opacity="0.85" />

      <g stroke="url(#maskLine)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5">
        <path d="M92 340 L136 356" />
        <path d="M88 362 L132 374" />
        <path d="M96 384 L138 392" />
        <path d="M308 340 L264 356" />
        <path d="M312 362 L268 374" />
        <path d="M304 384 L262 392" />
      </g>

      <path
        d="M200 316 L200 402 C200 414 190 420 182 424"
        stroke="url(#maskLine)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M200 402 C200 414 210 420 218 424"
        stroke="url(#maskLine)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M144 466 C176 450 224 450 256 466 C224 486 176 486 144 466 Z"
        stroke="url(#maskLine)"
        strokeWidth="1.8"
        fill="#030308"
        fillOpacity="0.55"
      />
      <g stroke="url(#maskLine)" strokeWidth="1.1" strokeOpacity="0.65">
        <path d="M162 448 L162 484" />
        <path d="M181 444 L181 488" />
        <path d="M200 442 L200 490" />
        <path d="M219 444 L219 488" />
        <path d="M238 448 L238 484" />
      </g>

      <g stroke="url(#maskLine)" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.45">
        <path d="M168 508 L168 528" />
        <path d="M184 504 L184 534" />
        <path d="M200 500 L200 540" />
        <path d="M216 504 L216 534" />
        <path d="M232 508 L232 528" />
      </g>
    </svg>
  );
}
