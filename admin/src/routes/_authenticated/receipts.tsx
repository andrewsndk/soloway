import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ReceiptText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { logActionQuietly } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUCKET = "expense-receipts";

type ReceiptRow = Tables<"expense_receipts">;

export const Route = createFileRoute("/_authenticated/receipts")({
  head: () => ({ meta: [{ title: "Чеки — Soloway CRM" }] }),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const qc = useQueryClient();
  const [receiptDate, setReceiptDate] = useState(today());
  const [file, setFile] = useState<File | null>(null);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["expense-receipts"],
    queryFn: fetchReceipts,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!receiptDate) throw new Error("Оберіть дату чека");
      if (!file) throw new Error("Оберіть файл чека");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData.user?.id ?? null;
      const filePath = `${receiptDate}/${Date.now()}-${safeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase
        .from("expense_receipts")
        .insert({
          receipt_date: receiptDate,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type || null,
          file_size: file.size,
          created_by: userId,
        })
        .select("*")
        .single();

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([filePath]);
        throw insertError;
      }

      await logActionQuietly({
        action: "create",
        entityType: "expense_receipt",
        entityId: inserted.id,
        entityLabel: inserted.file_name,
        summary: `Завантажено чек за ${formatDate(inserted.receipt_date)}`,
        after: inserted,
      });
    },
    onSuccess: () => {
      toast.success("Чек завантажено");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["expense-receipts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (receipt: ReceiptRow) => {
      const { error: deleteRowError } = await supabase
        .from("expense_receipts")
        .delete()
        .eq("id", receipt.id);
      if (deleteRowError) throw deleteRowError;

      const { error: deleteFileError } = await supabase.storage
        .from(BUCKET)
        .remove([receipt.file_path]);
      if (deleteFileError) throw deleteFileError;

      await logActionQuietly({
        action: "delete",
        entityType: "expense_receipt",
        entityId: receipt.id,
        entityLabel: receipt.file_name,
        summary: `Видалено чек за ${formatDate(receipt.receipt_date)}`,
        before: receipt,
      });
    },
    onSuccess: () => {
      toast.success("Чек видалено");
      qc.invalidateQueries({ queryKey: ["expense-receipts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const groupedReceipts = useMemo(() => {
    return receipts.reduce<Record<string, ReceiptRow[]>>((groups, receipt) => {
      groups[receipt.receipt_date] = [...(groups[receipt.receipt_date] ?? []), receipt];
      return groups;
    }, {});
  }, [receipts]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Чеки</h1>
        <p className="text-sm text-muted-foreground">Зберігайте фото або PDF чеків по витратах</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Додати чек</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="receipt-date">Дата чека</Label>
            <Input
              id="receipt-date"
              type="date"
              value={receiptDate}
              onChange={(event) => setReceiptDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipt-file">Файл</Label>
            <Input
              id="receipt-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending}>
            <Upload className="mr-1 h-4 w-4" />
            {uploadMut.isPending ? "Завантаження..." : "Завантажити"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Збережені чеки</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Завантаження...</p>
          ) : receipts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              <ReceiptText className="mx-auto mb-3 h-9 w-9" />
              <p>Поки немає завантажених чеків</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedReceipts).map(([date, items]) => (
                <section key={date} className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">{formatDate(date)}</h2>
                  <div className="grid gap-2">
                    {items.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="flex flex-col gap-3 rounded-2xl border bg-card p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 shrink-0 text-primary" />
                            <p className="truncate font-medium">{receipt.file_name}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatBytes(receipt.file_size)} · додано {formatDateTime(receipt.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2 md:shrink-0">
                          <Button variant="outline" size="sm" onClick={() => openReceipt(receipt)}>
                            <Download className="mr-1 h-4 w-4" />
                            Відкрити
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMut.mutate(receipt)}
                            disabled={deleteMut.isPending}
                            title="Видалити чек"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function fetchReceipts() {
  const { data, error } = await supabase
    .from("expense_receipts")
    .select("*")
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function openReceipt(receipt: ReceiptRow) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(receipt.file_path, 60);

  if (error) {
    toast.error(error.message);
    return;
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120) || "receipt";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return "розмір невідомий";
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}
