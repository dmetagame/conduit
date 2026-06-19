/**
 * Conduit brand mark — two parallel rails bent into an open "C" channel with a
 * value node settling at the mouth (a payment routed and settled). Monoline and
 * geometric so it stays legible down to a 16px favicon.
 */

/** The glyph alone. Inherits `currentColor` so it takes the surrounding text color. */
export function ConduitMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* outer rail — C-shaped channel, open on the right */}
      <path
        d="M22.77 24.67 A11 11 0 1 1 22.77 7.33"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* inner parallel rail */}
      <path
        d="M20 21.12 A6.5 6.5 0 1 1 20 10.88"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* value node settling at the mouth */}
      <circle cx="21.8" cy="16" r="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Horizontal lockup: mark + "Conduit" wordmark. The word is split into per-letter
 * spans (each `aria-hidden`, with an `aria-label` on the wrapper) so motion code can
 * stagger `.logo__char` for the hero reveal without depending on a GSAP plugin, while
 * screen readers still read a single "Conduit".
 */
export function Logo({
  markSize = 22,
  gradient = false,
  className = '',
}: {
  markSize?: number;
  gradient?: boolean;
  className?: string;
}) {
  const word = 'Conduit';
  return (
    <span className={`logo${gradient ? ' logo--gradient' : ''}${className ? ` ${className}` : ''}`}>
      <span className="logo__mark">
        <ConduitMark size={markSize} />
      </span>
      <span className="logo__word" aria-label={word}>
        {word.split('').map((ch, i) => (
          <span key={i} className="logo__char" aria-hidden="true">
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
