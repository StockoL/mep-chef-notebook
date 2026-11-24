/**
 * Hands a file to the chef. On a phone that opens the share sheet ("Save to
 * Files", AirDrop, email…); where sharing files isn't possible, it downloads.
 * Returns false if the chef cancelled the share sheet.
 */
export async function saveFile(bytes: Uint8Array, name: string, type: string): Promise<boolean> {
  const file = new File([bytes as Uint8Array<ArrayBuffer>], name, { type });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      // Any other failure: fall through to a download.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
