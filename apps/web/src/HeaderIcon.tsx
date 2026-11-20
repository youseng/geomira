/** Toolbar icons share a stroke weight at both pointer and touch sizes. */
const paths = {
  undo: 'M8 5 3 10l5 5 M3 10h9a7 7 0 0 1 7 7',
  redo: 'm16 5 5 5-5 5 M21 10h-9a7 7 0 0 0-7 7',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.5 4.5 6 6',
  down: 'm7 10 5 5 5-5',
  more: 'M4 12h.5m7.25 0h.5m7.25 0h.5',
  panels: 'M5 4.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z M14 5v14',
  view: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
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
