import type { RefObject } from 'react';
import { CLAIM_TESTING } from './features';
import { ErrorBanner } from './Dialogs';
import { ViewBanner } from './discovery-view';
import { reportOf, type usePage } from './page';
import { SafeUpdate } from './SafeUpdate';
import { NoticeLine } from './Stage';

interface Props {
  readonly page: Pick<
    ReturnType<typeof usePage>,
    'store' | 'about' | 'discovery' | 'internal' | 'setInternal' | 'snap'
  >;
  readonly command: RefObject<HTMLInputElement | null>;
  readonly showTab: (tab: 'Text') => void;
  readonly onRecoveryHost: (element: HTMLDivElement | null) => void;
}
/** Critical messages stay in page flow, with full copy and native actions visible. */
export function WorkspaceNotices(p: Props) {
  const { store, internal, setInternal, discovery, about, snap } = p.page;
  return (
    <section className="workspace-notices" aria-label="Messages">
      <div className="recovery-outlet" ref={p.onRecoveryHost} />
      {internal !== null && (
        <ErrorBanner
          message={internal}
          report={() => reportOf(store)}
          onClose={() => {
            setInternal(null);
          }}
        />
      )}
      <SafeUpdate
        store={store}
        pwa={about.pwa}
        command={p.command}
        onReviewText={() => {
          p.showTab('Text');
        }}
      />
      {CLAIM_TESTING && <ViewBanner discovery={discovery} />}
      <NoticeLine
        notice={snap.notice}
        onClose={() => {
          store.setNotice(null);
        }}
      />
    </section>
  );
}
