import { useEffect, useState } from 'preact/hooks';
import { getMedia } from '../../data/notes';
import type { Id } from '../../data/types';

/** Shows a stored photo, or a player for a voice note. */
export function MediaView({ id, compact }: { id: Id; compact?: boolean }) {
  const [media, setMedia] = useState<{ url: string; type: string } | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void getMedia(id).then((row) => {
      if (!row || cancelled) return;
      // A temporary URL for the Blob; released when this view goes away.
      url = URL.createObjectURL(row.blob);
      setMedia({ url, type: row.type });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (!media) return null;
  if (media.type.startsWith('image/')) {
    return <img class="media-view" data-compact={compact} src={media.url} alt="Captured photo" loading="lazy" />;
  }
  if (media.type.startsWith('audio/')) {
    // In a list row (itself a button) a player can't be nested: just say what it is.
    if (compact) return <span class="list-row__title">Voice note</span>;
    return <audio class="media-view" controls preload="metadata" src={media.url} />;
  }
  return null;
}
