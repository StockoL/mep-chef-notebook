import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
  /** "top" for sheets that open the keyboard: on iPhone the keyboard covers the bottom. */
  position?: 'bottom' | 'top';
  /** Keep the content mounted while closed (for a field the opener focuses at once). */
  keepMounted?: boolean;
  /** To open it straight from a tap handler: dialogRef.current.showModal(). */
  dialogRef?: RefObject<HTMLDialogElement | null>;
}

/**
 * A sheet over the current screen (UX → Navigation rule 4, Editing rule 1),
 * built on the native <dialog>: the browser handles focus, Escape and the top
 * layer (DECISIONS 23). "Done" closes; there's no Save button, because what's
 * in a sheet saves as it changes. Tapping outside closes it too.
 */
export function Sheet({ open, onClose, title, children, position = 'bottom', keepMounted, dialogRef }: SheetProps) {
  const ownRef = useRef<HTMLDialogElement>(null);
  const ref = dialogRef ?? ownRef;
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, ref]);

  return (
    <dialog
      ref={ref}
      class="sheet"
      data-position={position}
      aria-labelledby={titleId}
      onClose={onClose}
      // A tap on the backdrop lands on the <dialog> itself; taps inside land on its content.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div class="sheet__inner">
        <div class="sheet__header">
          <h2 class="sheet__title" id={titleId}>
            {title}
          </h2>
          <button class="button" type="button" data-variant="ghost" onClick={onClose}>
            Done
          </button>
        </div>
        <div class="sheet__body flow">{(open || keepMounted) && children}</div>
      </div>
    </dialog>
  );
}
