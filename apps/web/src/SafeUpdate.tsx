import { useRef, useState, type RefObject } from 'react';
import { UpdateBanner } from './about';
import { downloadGeo, downloadText } from './backup';
import { prepareUpdate, type UpdateRefusal } from './update-readiness';
import type { EditorStore } from './store';
import type { Pwa } from './pwa';

interface Props {
  readonly store: EditorStore;
  readonly pwa: Pwa;
  readonly command: RefObject<HTMLInputElement | null>;
  readonly onReviewText: () => void;
}
function Backup({ refusal, store, command }: Props & { refusal: UpdateRefusal }) {
  const [error, setError] = useState<string | null>(null);
  const source = refusal.kind === 'text' || refusal.kind === 'command';
  return (
    <>
      <button
        type="button"
        onClick={() => {
          try {
            if (refusal.kind === 'text')
              downloadText(
                store.textDraft.unappliedText() ?? store.textDraft.getSnapshot().text,
                'geomira-unapplied-text.txt',
              );
            else if (refusal.kind === 'command')
              downloadText(command.current?.value ?? '', 'geomira-command-draft.txt');
            else downloadGeo(store.current().doc);
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        {source
          ? refusal.kind === 'text'
            ? 'Download unapplied text'
            : 'Download command draft'
          : 'Download current figure'}
      </button>
      {error !== null && <p>{error}</p>}
    </>
  );
}
/** Refuse the transition while transient work exists; never execute or discard it implicitly. */
export function SafeUpdate(props: Props) {
  const [refusal, setRefusal] = useState<UpdateRefusal | null>(null);
  const busy = useRef(false);
  const attempt = useRef(0);
  const reload = async () => {
    if (busy.current) return;
    busy.current = true;
    const generation = ++attempt.current;
    try {
      const issue = await prepareUpdate(props.store, () => props.command.current?.value ?? '');
      if (generation !== attempt.current) return;
      setRefusal(issue);
      if (issue === null) props.pwa.applyUpdate(() => undefined);
    } catch (e) {
      if (generation !== attempt.current) return;
      setRefusal({
        kind: 'save',
        message: `Saving could not finish: ${String(e)}. Keep this page open and download a backup.`,
      });
    } finally {
      busy.current = false;
    }
  };
  const review = () => {
    if (refusal?.kind === 'command') {
      props.command.current?.focus();
      return;
    }
    props.onReviewText();
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Text"]')?.focus();
    });
  };
  return (
    <>
      <UpdateBanner
        onReload={() => {
          void reload();
        }}
        onLater={() => {
          attempt.current++;
          setRefusal(null);
        }}
      />
      {refusal !== null && (
        <section className="notice notice-info" role="alert" aria-label="Update paused">
          <p>{refusal.message}</p>
          <Backup {...props} refusal={refusal} />
          <button type="button" onClick={review}>
            {refusal.kind === 'command'
              ? 'Review command before updating'
              : 'Review text before updating'}
          </button>
        </section>
      )}
    </>
  );
}
