import { countInbox } from '../../data/notes';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { Sheet } from './Sheet';

/** The top bar's menu: the places that aren't tabs. */
export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inboxCount = useLiveQuery(() => countInbox());

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
    <Sheet open={open} onClose={onClose} title="Menu">
      <ul class="row-list" role="list">
        {links.map((link) => (
          <li key={link.href}>
            <a class="list-row" href={link.href} onClick={onClose}>
              <span class="list-row__main">
                <span class="list-row__title">{link.label}</span>
                {link.meta && <span class="list-row__meta">{link.meta}</span>}
              </span>
              <Icon name="chevron-right" />
            </a>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
