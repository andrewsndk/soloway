import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CheckoutTimeDialogProps = {
  open: boolean;
  childName?: string | null;
  defaultTime?: string;
  mode?: "check-in" | "check-out";
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (time: string) => void;
};

export function CheckoutTimeDialog({
  open,
  childName,
  defaultTime,
  mode = "check-out",
  pending,
  onOpenChange,
  onSubmit,
}: CheckoutTimeDialogProps) {
  const [time, setTime] = useState(defaultTime ?? "");
  const isCheckIn = mode === "check-in";

  useEffect(() => {
    if (open) setTime(defaultTime ?? "");
  }, [defaultTime, open]);

  const submit = () => {
    if (!time) return;
    onSubmit(time);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCheckIn ? "Час чек-іну" : "Час чек-ауту"}</DialogTitle>
          <DialogDescription>
            {childName
              ? `Оберіть, коли ${isCheckIn ? "прийшла" : "пішла"} дитина ${childName}.`
              : `Оберіть час ${isCheckIn ? "приходу" : "виходу"} дитини.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="visit-time">{isCheckIn ? "Час приходу" : "Час виходу"}</Label>
          <Input
            id="visit-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Скасувати
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !time}>
            {isCheckIn ? "Зберегти чек-ін" : "Зберегти чек-аут"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
