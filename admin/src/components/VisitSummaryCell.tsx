import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { compactDiff, logActionQuietly } from "@/lib/audit";
import { formatVisitNote } from "@/lib/visit-note-ai";

type VisitSummaryBooking = {
  id: string;
  client_id?: string | null;
  child_name: string;
  visit_date: string;
  format: string;
  teacher_comment: string | null;
  parent_summary: string | null;
};

export function VisitSummaryCell({ booking }: { booking: VisitSummaryBooking }) {
  const qc = useQueryClient();
  const sourceNote = booking.teacher_comment?.trim() ?? "";
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const currentSummary = summaryOverride ?? booking.parent_summary?.trim() ?? "";

  useEffect(() => {
    setSummaryOverride(null);
    setDraft(booking.parent_summary?.trim() ?? "");
  }, [booking.id, booking.parent_summary]);

  const formatMut = useMutation({
    mutationFn: async () => {
      if (!sourceNote) {
        throw new Error("У цьому візиті ще немає внутрішньої нотатки вихователя.");
      }

      const summary = await formatVisitNote({
        rawNote: sourceNote,
        childName: booking.child_name,
        visitDate: booking.visit_date,
        format: booking.format,
      });

      const { data: before } = await supabase.from("bookings").select("*").eq("id", booking.id).maybeSingle();
      const { data: updated, error } = await supabase
        .from("bookings")
        .update({ parent_summary: summary })
        .eq("id", booking.id)
        .select("*")
        .single();

      if (error) throw error;

      await logActionQuietly({
        action: "update",
        entityType: "booking",
        entityId: booking.id,
        entityLabel: `${updated.child_name} · ${updated.visit_date}`,
        summary: `Оформлено сводку для батьків по візиту ${updated.child_name}`,
        before: before ? compactDiff(before, updated) : null,
        after: updated,
      });

      return updated.parent_summary ?? summary;
    },
    onSuccess: (summary) => {
      setSummaryOverride(summary);
      setDraft(summary);
      setPreviewOpen(true);
      toast.success("Сводку для батьків збережено");
      qc.invalidateQueries({ queryKey: ["client-bookings"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["audit-logs-dashboard"] });
      if (booking.client_id) qc.invalidateQueries({ queryKey: ["solo-insight", booking.client_id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const nextSummary = draft.trim();
      if (!nextSummary) {
        throw new Error("Текст для батьків не може бути порожнім.");
      }

      const { data: before } = await supabase.from("bookings").select("*").eq("id", booking.id).maybeSingle();
      const { data: updated, error } = await supabase
        .from("bookings")
        .update({ parent_summary: nextSummary })
        .eq("id", booking.id)
        .select("*")
        .single();

      if (error) throw error;

      await logActionQuietly({
        action: "update",
        entityType: "booking",
        entityId: booking.id,
        entityLabel: `${updated.child_name} · ${updated.visit_date}`,
        summary: `Оновлено текст для батьків по візиту ${updated.child_name}`,
        before: before ? compactDiff(before, updated) : null,
        after: updated,
      });

      return updated.parent_summary ?? nextSummary;
    },
    onSuccess: (summary) => {
      setSummaryOverride(summary);
      setDraft(summary);
      toast.success("Текст для батьків збережено");
      qc.invalidateQueries({ queryKey: ["client-bookings"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["audit-logs-dashboard"] });
      if (booking.client_id) qc.invalidateQueries({ queryKey: ["solo-insight", booking.client_id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copySummary = async () => {
    if (!draft.trim()) return;
    await navigator.clipboard.writeText(draft.trim());
    toast.success("Текст скопійовано");
  };

  const openPreview = () => {
    setDraft(currentSummary);
    setPreviewOpen(true);
  };

  return (
    <div className="min-w-[220px] text-sm">
      {currentSummary ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Для батьків</Badge>
            <Button type="button" variant="outline" size="sm" onClick={openPreview}>
              Переглянути
            </Button>
            {sourceNote ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => formatMut.mutate()}
                disabled={formatMut.isPending}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {formatMut.isPending ? "Оформлення..." : "Переоформити"}
              </Button>
            ) : null}
          </div>
          {sourceNote ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Внутрішня нотатка</summary>
              <div className="mt-1">{sourceNote}</div>
            </details>
          ) : null}
        </div>
      ) : sourceNote ? (
        <div className="space-y-2">
          <div className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">{sourceNote}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => formatMut.mutate()}
            disabled={formatMut.isPending}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            {formatMut.isPending ? "Оформлення..." : "Оформити для батьків"}
          </Button>
        </div>
      ) : (
        "—"
      )}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Текст для батьків</DialogTitle>
            <DialogDescription>
              Повний текст по візиту {booking.child_name}. Його можна відредагувати перед копіюванням.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={14}
            className="min-h-[320px] whitespace-pre-wrap text-base leading-relaxed"
          />
          {sourceNote ? (
            <details className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Внутрішня нотатка вихователя</summary>
              <div className="mt-2 whitespace-pre-wrap">{sourceNote}</div>
            </details>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={copySummary} disabled={!draft.trim()}>
              <Copy className="mr-1 h-4 w-4" />
              Копіювати
            </Button>
            <Button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !draft.trim()}>
              {saveMut.isPending ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
