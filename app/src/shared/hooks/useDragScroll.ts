import { useEffect, type RefObject } from 'react';

/**
 * Makes a horizontally-overflowing strip (a `.scroll-x` carousel) usable with a
 * desktop pointer: click-and-drag to pan, and a vertical mouse-wheel scrolls it
 * sideways. Touch devices already pan natively, so touch input is left alone.
 *
 * Without this, a `.scroll-x` strip technically scrolls but has no visible
 * scrollbar and a mouse-wheel scrolls the page instead — so on desktop it feels
 * stuck. Attach the returned ref's element and overflow becomes a real carousel.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const canScrollX = () => el.scrollWidth > el.clientWidth + 1;

    // Vertical wheel → horizontal pan (only when there's overflow to pan).
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || !canScrollX()) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    // Pointer drag to pan (mouse/pen only — touch already pans natively).
    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !canScrollX()) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    };
    const onUp = () => { dragging = false; };
    // Swallow the click that ends a drag so a chip/tab isn't toggled mid-pan.
    const onClick = (e: MouseEvent) => {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, [ref]);
}
