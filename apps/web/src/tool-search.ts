/** The same public tool metadata drives search, the palette and recent tools. */
import { AVAILABLE_GROUPS } from './available-tools';
import type { ToolUI } from '@geomira/editor/tools';

export const SEARCH_TOOLS: readonly ToolUI[] = AVAILABLE_GROUPS.flatMap((group) => group.tools);
function words(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/centre/gu, 'center')
    .replace(/[_-]/gu, ' ');
}
export function matchingTools(query: string): readonly ToolUI[] {
  const parts = words(query).trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return [];
  return SEARCH_TOOLS.filter((tool) => {
    const operation = tool.build.kind === 'call' ? tool.build.tool : '';
    const content = words(`${tool.label} ${tool.id} ${operation} ${tool.help}`);
    return parts.every((part) => content.includes(part));
  }).slice(0, 12);
}
