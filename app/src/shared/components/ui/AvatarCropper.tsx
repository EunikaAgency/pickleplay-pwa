import { useEffect, useRef } from 'react';
import Croppie from 'croppie';
import 'croppie/croppie.css';
import { Button } from './Button';

interface AvatarCropperProps {
  /** The picked image file to crop. */
  file: File;
  /** True while the cropped result is being uploaded. */
  busy?: boolean;
  onCancel: () => void;
  /** Returns the circular-cropped PNG blob. */
  onCropped: (blob: Blob) => void;
}

/**
 * Circular avatar cropper backed by Croppie. Mounts a modal with a circle
 * viewport (drag to pan, pinch/zoom slider), and emits a circular PNG so the
 * stored photo is truly round, not just CSS-masked.
 */
export function AvatarCropper({ file, busy, onCancel, onCropped }: AvatarCropperProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const croppieRef = useRef<Croppie | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    const url = URL.createObjectURL(file);
    const c = new Croppie(elRef.current, {
      viewport: { width: 230, height: 230, type: 'circle' },
      boundary: { width: 270, height: 270 },
      showZoomer: true,
      enableExif: true,
    });
    croppieRef.current = c;
    void c.bind({ url });
    return () => {
      URL.revokeObjectURL(url);
      c.destroy();
      croppieRef.current = null;
    };
  }, [file]);

  const save = async () => {
    const c = croppieRef.current;
    if (!c) return;
    const blob = (await c.result({
      type: 'blob',
      size: { width: 400, height: 400 },
      format: 'png',
      circle: true,
    })) as Blob;
    onCropped(blob);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 flex items-center justify-center p-5">
      <div className="bg-[var(--surface)] rounded-3xl p-5 w-full max-w-[340px] flex flex-col items-center">
        <h3 className="hd-3 mb-1">Crop your photo</h3>
        <p className="t-sm mb-3 text-center">Drag to reposition · slider to zoom</p>
        <div ref={elRef} />
        <div className="grid grid-cols-2 gap-2 w-full mt-4">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="dark" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save photo'}</Button>
        </div>
      </div>
    </div>
  );
}
