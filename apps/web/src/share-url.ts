/**
 * The address of a share link: the page's own address without its query and hash, then the
 * link's fragment (`#s=…`). Built from the whole URL, not from `location.origin`, which is the
 * string "null" for a page opened from a file in some browsers (Run 12).
 */
export function shareUrl(href: string, fragment: string): string {
  const u = new URL(href);
  u.hash = '';
  u.search = '';
  return `${u.href}${fragment}`;
}
