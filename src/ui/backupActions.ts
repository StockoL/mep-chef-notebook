import { recordBackup } from '../data/backup';
import { exportData } from '../data/exportData';
import { exportFileName } from '../data/exportFormat';
import { showMessage } from './components/UndoBar';
import { saveFile } from './saveFile';

/**
 * Exports everything and hands the file to the chef (share sheet → Save to
 * Files, or a download). Counts as a backup only if it wasn't cancelled.
 */
export async function exportBackup(): Promise<void> {
  const saved = await saveFile(await exportData(), exportFileName(), 'application/zip');
  if (saved) {
    await recordBackup();
    showMessage('Backup saved.');
  } else {
    showMessage('Backup cancelled.');
  }
}
