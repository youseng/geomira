/** Toolbar icons share a stroke weight at both pointer and touch sizes. */
const paths = {
  undo: 'M8 5 3 10l5 5 M3 10h9a7 7 0 0 1 7 7',
  redo: 'm16 5 5 5-5 5 M21 10h-9a7 7 0 0 0-7 7',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.5 4.5 6 6',
  down: 'm7 10 5 5 5-5',
  more: 'M4 12h.5m7.25 0h.5m7.25 0h.5',
  view: 'M3 5h18v14H3z M15 5v14',
  export: 'M12 3v12m-5-5 5 5 5-5 M4 16v4h16v-4',
  saved: 'm4.5 12 5 5L20 6.5',
  warning: 'M12 5v8m0 4v.2',
  pending: 'M12 5v7l4 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
};
export type HeaderIconName = keyof typeof paths;
export function HeaderIcon({ name }: { name: HeaderIconName }) {
  return (
    <svg
      className={`header-icon icon-${name}`}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3.5 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
