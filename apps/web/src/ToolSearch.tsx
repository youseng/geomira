import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { ToolId } from '@geomira/editor/tool-state';
import { HeaderIcon } from './HeaderIcon';
import { modalOwnsInteraction } from './Modal';
import { matchingTools, SEARCH_TOOLS } from './tool-search';

export interface ToolSearchProps {
  readonly onChoose: (id: ToolId) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly recent: readonly string[];
}
function useSearch(onChoose: ToolSearchProps['onChoose'], recent: readonly string[]) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const matches = query.trim()
    ? matchingTools(query)
    : recent.flatMap((id) => SEARCH_TOOLS.find((t) => t.id === id) ?? []);
  const choose = (id: ToolId) => {
    onChoose(id);
    setQuery('');
    setIndex(-1);
    setOpen(false);
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setIndex((i) =>
        Math.max(0, Math.min(matches.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))),
      );
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const tool = matches[index] ?? matches[0];
      if (tool !== undefined) choose(tool.id);
    }
  };
  const change = (text: string) => {
    setQuery(text);
    setIndex(-1);
    setOpen(true);
  };
  return { query, open, index, matches, choose, key, change, setOpen };
}
type Search = ReturnType<typeof useSearch>;
function Results({ search: s }: { search: Search }) {
  const active = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest' });
  }, [s.index]);
  if (!s.open || (!s.query.trim() && s.matches.length === 0)) return null;
  return (
    <div className="tool-results">
      <div role="status" aria-label="Tool search results">
        {!s.query.trim()
          ? 'Recent tools'
          : s.matches.length === 0
            ? 'No tools match. Try a name such as midpoint or circle.'
            : `${String(s.matches.length)} matching tools`}
      </div>
      <ul
        id="tool-search-list"
        role="listbox"
        aria-label={s.query.trim() ? 'Matching tools' : 'Recent tools'}
      >
        {s.matches.map((tool, i) => (
          <li
            key={tool.id}
            ref={i === s.index ? active : undefined}
            id={`tool-result-${String(i)}`}
            role="option"
            aria-selected={i === s.index}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              s.choose(tool.id);
            }}
          >
            <strong>{tool.label}</strong>
            <span>{tool.help}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function useToolSearchShortcut(
  inputRef: ToolSearchProps['inputRef'],
  setOpen: (open: boolean) => void,
) {
  useEffect(() => {
    const focus = (event: globalThis.KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== 'k' ||
        event.defaultPrevented ||
        modalOwnsInteraction()
      )
        return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };
    window.addEventListener('keydown', focus);
    return () => {
      window.removeEventListener('keydown', focus);
    };
  }, [inputRef, setOpen]);
}

export function ToolSearch({ onChoose, inputRef, recent }: ToolSearchProps) {
  const s = useSearch(onChoose, recent);
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.userAgent);
  const { setOpen } = s;
  useToolSearchShortcut(inputRef, setOpen);
  const expanded = s.open && (s.query.trim() !== '' || s.matches.length > 0);
  return (
    <div className="tool-search">
      <label className="sr-only" htmlFor="tool-search-input">
        Find a tool
      </label>
      <HeaderIcon name="search" />
      <input
        id="tool-search-input"
        ref={inputRef}
        role="combobox"
        autoComplete="off"
        placeholder="Find a tool"
        aria-keyshortcuts="Control+K Meta+K"
        value={s.query}
        aria-expanded={expanded}
        aria-controls={expanded ? 'tool-search-list' : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          s.open && s.matches[s.index] !== undefined ? `tool-result-${String(s.index)}` : undefined
        }
        onClick={() => {
          s.setOpen(true);
        }}
        onFocus={() => {
          s.setOpen(true);
        }}
        onBlur={() => {
          s.setOpen(false);
        }}
        onChange={(e) => {
          s.change(e.target.value);
        }}
        onKeyDown={s.key}
      />
      <Results search={s} />
      <kbd className="search-shortcut" aria-hidden="true">
        {mac ? '⌘ K' : 'Ctrl K'}
      </kbd>
    </div>
  );
}
