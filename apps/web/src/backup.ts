/** Reusable canonical .geo backup. No document switching or persistence acknowledgement. */
import type { Document } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';

export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

export function downloadGeo(doc: Document): void {
  const name =
    (doc.meta.title ?? 'geomira-backup').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) ||
    'geomira-backup';
  downloadText(print(doc), `${name}.geo`);
}
