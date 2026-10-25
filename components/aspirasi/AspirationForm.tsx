"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { submitAspiration } from "@/app/aspirasi/actions";

export function AspirationForm({
  slug, maxLength, onSubmitted,
}: {
  slug: string;
  maxLength: number;
  onSubmitted: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  function grow() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function submit() {
    const value = text.trim();
    if (value.length < 2 || pending) return;
    setError(null);
    start(async () => {
      const res = await submitAspiration(slug, value, honeypot.current?.value ?? "");
      if (res.ok) {
        setText("");
        requestAnimationFrame(grow);
        toast("Terkirim");
        onSubmitted(value);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-2"
    >
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor="aspirasi-text" className="sr-only">Aspirasimu</label>
      <textarea
        id="aspirasi-text"
        ref={ref}
        rows={1}
        value={text}
        maxLength={maxLength}
        onChange={(e) => {
          setText(e.target.value);
          grow();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Tulis singkat, misal: perpanjang jam lab"
        className="max-h-40 min-h-11 w-full resize-none rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[15px] placeholder:text-muted"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[13px] text-muted" aria-live="polite">
          {text.length}/{maxLength}
        </span>
        <Button type="submit" disabled={pending || text.trim().length < 2}>
          {pending ? "Mengirim..." : "Kirim"}
        </Button>
      </div>
      {error ? <p role="alert" className="text-[14px] text-danger">{error}</p> : null}
    </form>
  );
}
