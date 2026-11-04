import {useEffect, useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {readBytes} from '../native/files';

/** Display URLs are transient; persisted records keep their owner FileRef. */
export async function imageUrl(file: string): Promise<{url: string; release(): void}> {
  if (Capacitor.isNativePlatform()) return {url: Capacitor.convertFileSrc(file), release() {}};
  const bytes = await readBytes(file);
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>]));
  return {url, release: () => URL.revokeObjectURL(url)};
}

export function useImageUrl(file: string | undefined) {
  const [state, setState] = useState<{file: string; url?: string; failed?: boolean} | null>(null);
  useEffect(() => {
    if (!file) return;
    let live = true;
    let release: (() => void) | undefined;
    void imageUrl(file).then(image => {
      if (!live) {image.release(); return;}
      release = image.release;
      setState({file, url: image.url});
    }).catch(() => {if (live) setState({file, failed: true});});
    return () => {live = false; release?.();};
  }, [file]);
  return state?.file === file ? state : null;
}
