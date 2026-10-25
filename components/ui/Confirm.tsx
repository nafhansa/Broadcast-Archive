"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./fields";

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Hapus", typeToConfirm, onConfirm, busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  typeToConfirm?: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const blocked = typeToConfirm ? typed !== typeToConfirm : false;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setTyped(""); onOpenChange(o); }} title={title} description={description}>
      {typeToConfirm ? (
        <div className="mb-4">
          <p className="text-[13px] text-muted mb-1">Ketik <span className="font-mono">{typeToConfirm}</span> untuk melanjutkan</p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Batal</Button>
        <Button variant="danger" disabled={blocked || busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
