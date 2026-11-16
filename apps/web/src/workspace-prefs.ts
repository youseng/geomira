/** Workspace preferences are best-effort host UI state, never geometry or save guarantees. */
export interface WorkspacePrefs {
  readonly collapsed: boolean;
  readonly width: number;
  readonly compact: boolean;
  readonly guideDismissed: boolean;
  readonly recent: readonly string[];
}
export const DEFAULT_WORKSPACE: WorkspacePrefs = {
  collapsed: false,
  width: 320,
  compact: true,
  guideDismissed: false,
  recent: [],
};
const KEY = 'geomira.workspace.v1';
export function readWorkspace(): WorkspacePrefs {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return DEFAULT_WORKSPACE;
    return {
      collapsed: 'collapsed' in value && value.collapsed === true,
      width:
        'width' in value && typeof value.width === 'number' && Number.isFinite(value.width)
          ? Math.max(240, Math.min(560, value.width))
          : 320,
      compact: !('compact' in value) || value.compact !== false,
      guideDismissed: 'guideDismissed' in value && value.guideDismissed === true,
      recent:
        'recent' in value && Array.isArray(value.recent)
          ? value.recent.filter((id): id is string => typeof id === 'string').slice(0, 5)
          : [],
    };
  } catch {
    return DEFAULT_WORKSPACE;
  }
}
export function writeWorkspace(value: WorkspacePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* Preference failure does not imply a failed geometry save. Controls still work. */
  }
}
/** Reserve a usable canvas and palette before allowing the sidebar to grow. */
export function panelWidth(width: number, viewport: number): number {
  return Math.max(240, Math.min(width, 560, Math.max(240, viewport - 420)));
}
