"use client";

import * as RT from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState } from "react";

type Item = { id: number; text: string; error?: boolean };
const Ctx = createContext<(text: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const push = useCallback((text: string, error?: boolean) => {
    setItems((l) => [...l, { id: Date.now() + Math.random(), text, error }]);
  }, []);
  return (
    <Ctx.Provider value={push}>
      <RT.Provider swipeDirection="right" duration={3000}>
        {children}
        {items.map((t) => (
          <RT.Root
            key={t.id}
            onOpenChange={(o) => !o && setItems((l) => l.filter((x) => x.id !== t.id))}
            className={`rounded-md border px-4 py-3 text-[14px] ${t.error ? "bg-danger-bg border-danger/30 text-danger" : "bg-surface border-line-strong text-ink"}`}
          >
            <RT.Description>{t.text}</RT.Description>
          </RT.Root>
        ))}
        <RT.Viewport className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[60] flex w-[calc(100vw-32px)] max-w-sm flex-col gap-2 outline-none" />
      </RT.Provider>
    </Ctx.Provider>
  );
}
