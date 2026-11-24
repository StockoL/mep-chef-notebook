import { Icon } from '../icons';

/**
 * Above the tabs on every main screen: one tap to write a note, and photo,
 * voice and waste one tap each (docs/UX.md → Today).
 * Phase 1 wires these up; for now they're placeholders that do nothing.
 */
export function CaptureBar() {
  return (
    <div class="capture-bar">
      <button class="capture-bar__note" type="button">
        Jot a note…
      </button>
      <button class="capture-bar__action" type="button" aria-label="Photo">
        <Icon name="camera" />
      </button>
      <button class="capture-bar__action" type="button" aria-label="Voice note">
        <Icon name="mic" />
      </button>
      <button class="capture-bar__action" type="button" aria-label="Log waste">
        <Icon name="bin" />
      </button>
    </div>
  );
}
