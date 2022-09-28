import { useEffect } from '../lib/teact/teact';

const MAX_MESSAGE_LENGTH = 4096;

const useClipboardPaste = (isActive: boolean, onPaste: (value: string) => void) => {
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) {
        return;
      }

      const pastedText = e.clipboardData.getData('text').substring(0, MAX_MESSAGE_LENGTH);

      if (!pastedText) {
        return;
      }

      e.preventDefault();

      onPaste(pastedText);
    }

    document.addEventListener('paste', handlePaste, false);

    return () => {
      document.removeEventListener('paste', handlePaste, false);
    };
  }, [isActive, onPaste]);
};

export default useClipboardPaste;
