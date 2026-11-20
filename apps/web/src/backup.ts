/** Reusable canonical .geo backup. No document switching or persistence acknowledgement. */
import { type PortableDocument, printPortable } from '@geomira/lang/portable';
import { documentFileName, MAX_FILE_BYTES } from './document-file';

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

export function downloadableGeo(doc: PortableDocument): string {
  const text = printPortable(doc);
  if (doc.writeUp && new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error(
      'The combined document exceeds the 2 MiB .geo file limit. Download the figure and Markdown separately.',
    );
  return text;
}

export function downloadGeo(doc: PortableDocument): void {
  downloadText(downloadableGeo(doc), documentFileName(doc));
}
