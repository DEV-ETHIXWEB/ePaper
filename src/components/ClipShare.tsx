"use client";

import { useState } from "react";

/**
 * What a reader sees after cropping: a preview and the places they actually
 * share to. WhatsApp first — for a Punjabi newspaper audience it carries more
 * sharing than everything else combined.
 */
export default function ClipShare({
  id,
  imageUrl,
  pageUrl,
  onClose,
}: {
  id: string;
  imageUrl: string;
  pageUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // What gets shared is the clip's own page, not the image file: the page
  // carries the OpenGraph tags, so WhatsApp and Facebook build a preview card
  // and the reader lands somewhere that links back to the full edition.
  const share =
    typeof window === "undefined" ? `/clip/${id}/` : `${window.location.origin}/clip/${id}/`;
  const enc = encodeURIComponent;

  const targets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(share)}`, cls: "bg-[#0f7a6c]" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(share)}`, cls: "bg-[#1465d8]" },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${enc(share)}`, cls: "bg-black" },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(share)}`, cls: "bg-[#0077b5]" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ਕਲਿੱਪ ਸਾਂਝਾ ਕਰੋ"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-bold">ਕਲਿੱਪ ਤਿਆਰ ਹੈ</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="ਕਲਿੱਪ" className="mb-4 w-full rounded-lg border border-line border-line" />

        <div className="mb-3 flex flex-wrap gap-2">
          {targets.map((t) => (
            <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer"
              className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${t.cls}`}>
              {t.label}
            </a>
          ))}
          <a href={imageUrl} download
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold border-line">
            ਡਾਊਨਲੋਡ
          </a>
        </div>

        <div className="flex gap-2">
          <input readOnly value={share}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs border-line bg-surface" />
          <button type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch { /* clipboard blocked; the field is selectable */ }
            }}
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold border-line">
            {copied ? "ਕਾਪੀ ਹੋਇਆ" : "ਕਾਪੀ"}
          </button>
        </div>

        <div className="mt-4 flex justify-between">
          <a href={pageUrl} className="text-xs underline">ਪੂਰਾ ਸਫ਼ਾ ਵੇਖੋ</a>
          <button type="button" onClick={onClose} className="text-xs underline">ਬੰਦ ਕਰੋ</button>
        </div>
      </div>
    </div>
  );
}
