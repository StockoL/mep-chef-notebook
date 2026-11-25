import { useState } from 'preact/hooks';
import { getPlaceDetails } from '../../data/kitchens';
import { countInbox } from '../../data/notes';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { KitchenPicker } from './KitchenPicker';
import { Sheet } from './Sheet';

/** The top bar's menu: switching kitchen, and the places that aren't tabs. */
export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inboxCount = useLiveQuery(() => countInbox());
  const details = useLiveQuery(() => getPlaceDetails());
  const [switching, setSwitching] = useState(false);
  const close = () => {
    setSwitching(false);
    onClose();
  };

  const links = [
    { href: paths.inbox, label: 'Inbox', meta: inboxCount ? `${inboxCount} to sort` : undefined },
    { href: paths.sheets, label: 'Sheets' },
    { href: paths.notes, label: 'Kitchen notes' },
    { href: paths.waste, label: 'Waste log' },
    { href: paths.goal, label: 'Weekly goal' },
    { href: paths.kitchens, label: 'Kitchens' },
    { href: paths.settings, label: 'App settings' },
  ];

  return (
    <Sheet open={open} onClose={close} title={switching ? 'Which kitchen?' : 'Menu'}>
      {switching ? (
        <KitchenPicker onChosen={close} />
      ) : (
        <ul class="row-list" role="list">
          <li>
            <button class="list-row" type="button" onClick={() => setSwitching(true)}>
              <span class="list-row__main">
                <span class="list-row__title">Kitchen: {details?.kitchen?.name ?? 'No kitchen'}</span>
                <span class="list-row__meta">Switch kitchen</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
          {links.map((link) => (
            <li key={link.href}>
              <a class="list-row" href={link.href} onClick={close}>
                <span class="list-row__main">
                  <span class="list-row__title">{link.label}</span>
                  {link.meta && <span class="list-row__meta">{link.meta}</span>}
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
