/** Lionheart shield: gold field, evergreen "L". */
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 2.5 35.5 8v12c0 8.6-6.3 15-15.5 17.5C10.8 35 4.5 28.6 4.5 20V8Z" fill="#eaa93a" />
      <path d="M14.5 11.5h5v13h7.5v4.5H14.5Z" fill="#12302a" />
    </svg>
  );
}
