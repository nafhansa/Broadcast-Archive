"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { updatePojok } from "@/app/admin/actions";

export function PojokSwitches({ id, isOpen, isVisible }: { id: string; isOpen: boolean; isVisible: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const set = (patch: { is_open?: boolean; is_visible?: boolean }) =>
    start(async () => {
      const r = await updatePojok(id, patch);
      if (r.ok) router.refresh();
      else toast(r.error, true);
    });
  return (
    <>
      <label className="flex items-center gap-1 text-[13px]">Dibuka<Switch label="Dibuka" checked={isOpen} disabled={pending} onChange={(v) => set({ is_open: v })} /></label>
      <label className="flex items-center gap-1 text-[13px]">Tampil<Switch label="Tampil" checked={isVisible} disabled={pending} onChange={(v) => set({ is_visible: v })} /></label>
    </>
  );
}
