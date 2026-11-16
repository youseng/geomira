import { useState, type KeyboardEvent, type RefObject } from 'react';
import type { ToolId } from '@geomira/editor/tool-state';
import { matchingTools, SEARCH_TOOLS } from './tool-search';

export interface ToolSearchProps {
  readonly onChoose: (id: ToolId) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly recent: readonly string[];
}
function useSearch(onChoose: ToolSearchProps['onChoose']) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const matches = matchingTools(query);
  const choose = (id: ToolId) => {
    onChoose(id);
    setQuery('');
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
  if (!s.open || s.query === '') return null;
  return (
    <div className="tool-results">
      <div role="status" aria-label="Tool search results">
        {s.matches.length === 0
          ? 'No tools match. Try a name such as midpoint or circle.'
          : `${String(s.matches.length)} matching tools`}
      </div>
      <ul id="tool-search-list" role="listbox" aria-label="Matching tools">
        {s.matches.map((tool, i) => (
          <li
            key={tool.id}
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
function Recent({ recent, choose }: { recent: readonly string[]; choose: (id: ToolId) => void }) {
  const tools = recent.flatMap((id) => {
    const tool = SEARCH_TOOLS.find((t) => t.id === id);
    return tool === undefined ? [] : [tool];
  });
  if (tools.length === 0) return null;
  return (
    <details className="recent-tools">
      <summary aria-label="Recent tools">Recent</summary>
      <div role="group" aria-label="Recent tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            aria-label={`Recent: ${tool.label}`}
            onClick={(e) => {
              e.currentTarget.closest('details')?.removeAttribute('open');
              choose(tool.id);
            }}
          >
            {tool.label}
          </button>
        ))}
      </div>
    </details>
  );
}
export function ToolSearch({ onChoose, inputRef, recent }: ToolSearchProps) {
  const s = useSearch(onChoose);
  return (
    <div className="tool-search">
      <label className="sr-only" htmlFor="tool-search-input">
        Find a tool
      </label>
      <input
        id="tool-search-input"
        ref={inputRef}
        role="combobox"
        autoComplete="off"
        placeholder="Find a tool…"
        value={s.query}
        aria-expanded={s.open && s.query !== ''}
        aria-controls="tool-search-list"
        aria-autocomplete="list"
        aria-activedescendant={
          s.open && s.matches[s.index] !== undefined ? `tool-result-${String(s.index)}` : undefined
        }
        onFocus={() => {
          if (s.query !== '') s.setOpen(true);
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
      <Recent recent={recent} choose={s.choose} />
    </div>
  );
}
