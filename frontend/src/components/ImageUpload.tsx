"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload, IpfsUploadError } from "@/lib/ipfs";
import { useStrings } from "@/lib/locale";

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "error"; message: string };

/**
 * Campaign image upload. One file → pinned to IPFS on select → the CID is
 * lifted to the parent via `onChange` (the value the form submits). A local object URL gives an
 * instant preview so the gate never waits on gateway resolution. Four states live here: empty
 * dropzone, uploading, uploaded (preview + CID + replace/remove), and an inline error with retry.
 * The parent owns only the CID string; this component owns the pick/upload lifecycle.
 */
export function ImageUpload({
  cid,
  onChange,
  disabled,
}: {
  cid: string | null;
  onChange: (cid: string | null) => void;
  disabled?: boolean;
}) {
  const strings = useStrings();
  const im = strings.campaign.create.image;
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Revoke the object URL when it changes or on unmount so we never leak blobs.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = useCallback(
    async (file: File) => {
      if (disabled) return;
      const localUrl = URL.createObjectURL(file);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });
      setState({ phase: "uploading" });
      onChange(null);
      try {
        const newCid = await upload(file);
        onChange(newCid);
        setState({ phase: "idle" });
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof IpfsUploadError ? err.message : im.errorFallback,
        });
      }
    },
    [disabled, onChange, im.errorFallback],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ""; // allow re-selecting the same file after a remove
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) void handleFile(file);
  };

  const clear = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onChange(null);
    setState({ phase: "idle" });
  };

  const openPicker = () => inputRef.current?.click();

  const uploading = state.phase === "uploading";
  const hasImage = preview !== null && (cid !== null || uploading);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onInputChange}
        disabled={disabled || uploading}
        className="sr-only"
      />

      {hasImage ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="relative aspect-[16/9] bg-line/40">
            <img src={preview!} alt={im.previewAlt} className="h-full w-full object-cover" />
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
                <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-muted">
                  <Spinner />
                  {im.uploading}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="min-w-0 truncate text-xs text-faint">
              {cid ? (
                <>
                  <span className="font-medium text-muted">{im.cidLabel}</span>{" "}
                  <span className="tabular">{cid}</span>
                </>
              ) : (
                im.uploading
              )}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={openPicker}
                className="text-xs font-bold text-green transition-colors hover:text-deep disabled:opacity-60"
              >
                {im.replace}
              </button>
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={clear}
                className="text-xs font-medium text-muted underline underline-offset-2 hover:text-cat-disaster disabled:opacity-60"
              >
                {im.remove}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors disabled:opacity-60 ${
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong bg-paper hover:border-accent/50 hover:bg-accent-soft/50"
          }`}
        >
          <ImageIcon />
          <span className="mt-1 text-sm font-medium text-ink">{im.dropPrompt}</span>
          <span className="text-xs text-faint">{im.dropHint}</span>
          <span className="mt-2 inline-block rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
            {im.pickFile}
          </span>
        </button>
      )}

      {state.phase === "error" ? (
        <p className="mt-2 text-sm text-cat-disaster">{state.message}</p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      className="h-7 w-7 text-faint"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L20 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
