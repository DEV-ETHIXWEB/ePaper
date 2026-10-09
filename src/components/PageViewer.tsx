"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ClipShare from "./ClipShare";

export interface ViewerPage {
  id: number;
  number: number;
  width: number;
  height: number;
  read: string;
  full: string;
  thumb: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

interface Rect { x: number; y: number; w: number; h: number }

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

  // Clipping
  const [clipMode, setClipMode] = useState(false);
  const [sel, setSel] = useState<Rect | null>(null);
  const [clipping, setClipping] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clip, setClip] = useState<{ id: string; url: string } | null>(null);
  const selStart = useRef<{ x: number; y: number } | null>(null);

  const page = pages[index];

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback(
    (n: number) => {
      const clamped = Math.min(Math.max(n, 0), pages.length - 1);
      setIndex(clamped);
      resetView();
      setSel(null);
      setClipError(null);
      onPageChange?.(clamped + 1);
    },
    [pages.length, onPageChange, resetView],
  );

  // Keyboard: arrows page through, +/- zoom, 0 resets. A newspaper reader on a
  // laptop expects these without reaching for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") { setClipMode(false); setSel(null); }
      else if (e.key === "ArrowRight" || e.key === "PageDown") goTo(index + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(index - 1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z * 1.4, MAX_ZOOM));
      else if (e.key === "-") setZoom((z) => Math.max(z / 1.4, MIN_ZOOM));
      else if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo, resetView]);

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

  /**
   * Clip mode drops back to the fit-to-width view before anything is selected.
   * Mapping a selection through a pan and a scale is possible but gets the
   * edges subtly wrong, and a crop that is off by a column of type is worse
   * than making the reader zoom out first.
   */
  const toggleClipMode = () => {
    setClipMode((on) => {
      if (!on) resetView();
      return !on;
    });
    setSel(null);
    setClipError(null);
  };

  // Clip selection, in fractions of the rendered page so the server can map it
  // onto the full-resolution render whatever size this screen loaded.
  const pointToFraction = (clientX: number, clientY: number) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: Math.min(Math.max((clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((clientY - box.top) / box.height, 0), 1),
    };
  };

  const onSelectStart = (e: React.PointerEvent) => {
    if (!clipMode) return;
    const p = pointToFraction(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    selStart.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
    setClipError(null);
  };

  const onSelectMove = (e: React.PointerEvent) => {
    if (!clipMode || !selStart.current) return;
    const p = pointToFraction(e.clientX, e.clientY);
    if (!p) return;
    const s = selStart.current;
    setSel({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };

  const onSelectEnd = () => {
    if (!selStart.current) return;
    selStart.current = null;
    // Matches the server's floor, so a too-small drag is cleared here rather
    // than rejected after a round trip.
    setSel((s) => (s && s.w >= 0.02 && s.h >= 0.01 ? s : null));
  };

  const submitClip = async () => {
    if (!sel || !page) return;
    setClipping(true);
    setClipError(null);
    try {
      const res = await fetch("/api/clip/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId: page.id, ...sel }),
      });
      const data: { id?: string; url?: string; error?: string } = await res.json();
      if (!res.ok || !data.id || !data.url) {
        throw new Error(data.error ?? "Could not create the clip.");
      }
      setClip({ id: data.id, url: data.url });
    } catch (err) {
      setClipError(err instanceof Error ? err.message : "Could not create the clip.");
    } finally {
      setClipping(false);
    }
  };

  if (!page) return null;

  // Above this, the larger render is worth its bytes.
  const src = zoom > 1.4 ? page.full : page.read;
  const pct = (n: number) => `${n * 100}%`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-40">
          ← ਪਿੱਛੇ
        </button>
        <span className="text-sm tabular-nums text-ink-faint">
          ਸਫ਼ਾ {page.number} / {pages.length}
        </span>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === pages.length - 1}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-40">
          ਅੱਗੇ →
        </button>

        <div className="ms-auto flex items-center gap-1">
          <button type="button" onClick={toggleClipMode} aria-pressed={clipMode}
            className={`me-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${
              clipMode
                ? "bg-brand text-white"
                : "border border-line"
            }`}>
            ✂ ਕਲਿੱਪ
          </button>
          <button type="button" aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(z / 1.4, MIN_ZOOM))}
            className="size-9 rounded-lg border border-line text-lg">−</button>
          <span className="w-14 text-center text-sm tabular-nums text-ink-faint">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(z * 1.4, MAX_ZOOM))}
            className="size-9 rounded-lg border border-line text-lg">+</button>
          <button type="button" onClick={resetView}
            className="ms-1 rounded-lg border border-line px-3 py-1.5 text-sm">
            ਰੀਸੈੱਟ
          </button>
        </div>
      </div>

      {clipMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950/40">
          <span className="text-ink">
            ਖ਼ਬਰ ਦੇ ਦੁਆਲੇ ਉਂਗਲ ਜਾਂ ਮਾਊਸ ਨਾਲ ਚੌਰਸ ਬਣਾਓ
          </span>
          <button type="button" onClick={submitClip} disabled={!sel || clipping}
            className="ms-auto rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            {clipping ? "ਤਿਆਰ ਹੋ ਰਿਹਾ…" : "ਸਾਂਝਾ ਕਰੋ"}
          </button>
          <button type="button" onClick={toggleClipMode}
            className="text-xs underline">ਰੱਦ ਕਰੋ</button>
        </div>
      )}

      {clipError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {clipError}
        </p>
      )}

      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-xl border border-line bg-surface-soft bg-surface"
        style={{
          touchAction: clipMode || zoom > 1 ? "none" : "pan-y",
          cursor: clipMode ? "crosshair" : zoom > 1 ? (dragging ? "grabbing" : "grab") : "auto",
        }}
        onPointerDown={onSelectStart}
        onPointerMove={onSelectMove}
        onPointerUp={onSelectEnd}
        onPointerCancel={onSelectEnd}
        onMouseDown={(e) => { if (!clipMode) startDrag(e.clientX, e.clientY); }}
        onMouseMove={(e) => { if (!clipMode) moveDrag(e.clientX, e.clientY); }}
        onMouseUp={() => { if (!clipMode) endDrag(); }}
        onMouseLeave={() => { if (!clipMode) endDrag(); }}
        onTouchStart={(e) => {
          if (clipMode) return;
          if (e.touches.length === 2) pinch.current = { dist: touchDistance(e.touches), zoom };
          else if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          if (clipMode) return;
          if (e.touches.length === 2 && pinch.current) {
            const ratio = touchDistance(e.touches) / pinch.current.dist;
            setZoom(Math.min(Math.max(pinch.current.zoom * ratio, MIN_ZOOM), MAX_ZOOM));
          } else if (e.touches.length === 1) {
            moveDrag(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={() => { if (!clipMode) { endDrag(); pinch.current = null; } }}
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

        {clipMode && sel && sel.w > 0 && sel.h > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute border-2 border-brand-ink bg-brand-ink/20"
            style={{ left: pct(sel.x), top: pct(sel.y), width: pct(sel.w), height: pct(sel.h) }}
          />
        )}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {pages.map((p, i) => (
          <button key={p.number} type="button" onClick={() => goTo(i)}
            aria-label={`ਸਫ਼ਾ ${p.number}`} aria-current={i === index}
            className={`shrink-0 overflow-hidden rounded border-2 transition-colors ${
              i === index ? "border-brand" : "border-transparent hover:border-brand-ink"
            }`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} alt="" width={64} height={90} loading="lazy"
              className="block h-[90px] w-16 bg-white object-cover" />
            <span className="block py-0.5 text-center text-[10px] tabular-nums text-ink-faint">
              {p.number}
            </span>
          </button>
        ))}
      </div>

      {clip && (
        <ClipShare
          id={clip.id}
          imageUrl={clip.url}
          pageUrl={typeof window === "undefined" ? "/" : window.location.href}
          onClose={() => { setClip(null); setSel(null); setClipMode(false); }}
        />
      )}
    </div>
  );
}
