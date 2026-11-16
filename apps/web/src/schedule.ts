/** Host timer primitive shared by drafts and pointer gestures, without editor imports. */
export type Schedule = (f: () => void, ms: number) => () => void;

export const timeout: Schedule = (f, ms) => {
  const timer = setTimeout(f, ms);
  return () => {
    clearTimeout(timer);
  };
};
