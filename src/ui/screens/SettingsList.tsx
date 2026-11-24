import type { ListName } from '../../data/types';
import { ListEditor } from '../components/ListEditor';
import { ScreenHeader } from '../components/ScreenHeader';
import { paths } from '../router';

const TITLES: Partial<Record<ListName, { title: string; item: string }>> = {
  'waste-reasons': { title: 'Waste reasons', item: 'waste reason' },
  'component-types': { title: 'Component types', item: 'component type' },
  'technique-categories': { title: 'Technique categories', item: 'technique category' },
};

/** One of the chef's own lists (DECISIONS 16): /settings/lists/:list */
export function SettingsList({ list }: { list?: string }) {
  const names = TITLES[list as ListName];
  if (!names) return <ScreenHeader title="List not found" back={{ href: paths.settings, label: 'Settings' }} />;
  return (
    <section class="flow">
      <ScreenHeader title={names.title} back={{ href: paths.settings, label: 'Settings' }} />
      <ListEditor listRef={{ kind: 'values', list: list as ListName, kitchenId: null }} itemName={names.item} />
    </section>
  );
}
