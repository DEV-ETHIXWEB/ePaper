"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ViewerPage {
  number: number;
  width: number;
  height: number;
  read: string;
  full: string;
  thumb: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

/**
 * The page reader.
 *
 * Two images per page, swapped by zoom level: the screen-width render while
 * reading, the large one once someone zooms past 1.4x. Loading the zoom render
 * up front would mean every page view pulls a multi-megabyte image on a phone,
 * which is what makes most epaper sites painful on mobile data.
 */
export default function PageViewer({
  pages,
  initialPage = 1,
  onPageChange,
}: {
  pages: ViewerPage[];
  initialPage?: number;
  onPageChange?: (n: number) => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialPage, 1), pages.length) - 1,
  );
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Whether a drag is in flight has to be state, not a ref: the render reads it
  // to disable the easing transition, and reading a ref during render is not
  // allowed (React cannot know to re-render when it changes).
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const page = pages[index];

  const goTo = useCallback(
    (n: number) => {
      const clamped = Math.min(Math.max(n, 0), pages.length - 1);
      setIndex(clamped);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      onPageChange?.(clamped + 1);
    },
    [pages.length, onPageChange],
  );

  // Keyboard: arrows page through, +/- zoom, 0 resets. A newspaper reader on a
  // laptop expects these without reaching for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(index + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(index - 1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z * 1.4, MAX_ZOOM));
      else if (e.key === "-") setZoom((z) => Math.max(z / 1.4, MIN_ZOOM));
      else if (e.key === "0") { setZoom(1); setOffset({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo]);

  // Ctrl/⌘ + wheel zooms; a plain wheel still scrolls the page as normal.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(Math.max(z * (e.deltaY < 0 ? 1.12 : 0.89), MIN_ZOOM), MAX_ZOOM));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const startDrag = (x: number, y: number) => {
    if (zoom <= 1) return;
    drag.current = { x, y, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  const moveDrag = (x: number, y: number) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (x - drag.current.x),
      y: drag.current.oy + (y - drag.current.y),
    });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const touchDistance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  if (!page) return null;

  // Above this, the larger render is worth its bytes.
  const src = zoom > 1.4 ? page.full : page.read;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-neutral-700">
          ← ਪਿੱਛੇ
        </button>
        <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
          ਸਫ਼ਾ {page.number} / {pages.length}
        </span>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === pages.length - 1}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-neutral-700">
          ਅੱਗੇ →
        </button>

        <div className="ms-auto flex items-center gap-1">
          <button type="button" aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(z / 1.4, MIN_ZOOM))}
            className="size-9 rounded-lg border border-neutral-300 text-lg dark:border-neutral-700">−</button>
          <span className="w-14 text-center text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(z * 1.4, MAX_ZOOM))}
            className="size-9 rounded-lg border border-neutral-300 text-lg dark:border-neutral-700">+</button>
          <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="ms-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
            ਰੀਸੈੱਟ
          </button>
        </div>
      </div>

      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        style={{
          touchAction: zoom > 1 ? "none" : "pan-y",
          cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "auto",
        }}
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinch.current = { dist: touchDistance(e.touches), zoom };
          else if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) {
            const ratio = touchDistance(e.touches) / pinch.current.dist;
            setZoom(Math.min(Math.max(pinch.current.zoom * ratio, MIN_ZOOM), MAX_ZOOM));
          } else if (e.touches.length === 1) {
            moveDrag(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={() => { endDrag(); pinch.current = null; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`ਸਫ਼ਾ ${page.number}`}
          width={page.width}
          height={page.height}
          draggable={false}
          className="mx-auto block h-auto w-full select-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "center top",
            transition: dragging ? "none" : "transform 120ms ease-out",
          }}
        />
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {pages.map((p, i) => (
          <button key={p.number} type="button" onClick={() => goTo(i)}
            aria-label={`ਸਫ਼ਾ ${p.number}`} aria-current={i === index}
            className={`shrink-0 overflow-hidden rounded border-2 transition-colors ${
              i === index ? "border-blue-600" : "border-transparent hover:border-neutral-400"
            }`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} alt="" width={64} height={90} loading="lazy"
              className="block h-[90px] w-16 bg-white object-cover" />
            <span className="block py-0.5 text-center text-[10px] tabular-nums text-neutral-500">
              {p.number}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
