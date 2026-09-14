/** Original vector monogram: Q + x, shared by the launcher and assistant. */
export function QxMark({ thinking = false }: { thinking?: boolean }) {
  return (
    <svg
      className={`ra-qx-mark${thinking ? " is-thinking" : ""}`}
      viewBox="0 0 48 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g className="ra-qx-q">
        <ellipse cx="16" cy="20" rx="10" ry="12" />
        <path d="m19 26 9 10" />
      </g>
      <g className="ra-qx-x">
        <path d="m31 17 11 14M42 17 31 31" />
      </g>
    </svg>
  );
}
