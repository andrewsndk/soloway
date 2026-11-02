import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { logActionQuietly } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BUCKET = "expense-receipts";

type ReceiptRow = Tables<"expense_receipts">;
type ExpenseRow = Tables<"cash_expenses">;

export const Route = createFileRoute("/_authenticated/receipts")({
  head: () => ({ meta: [{ title: "Чеки — Soloway CRM" }] }),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [expenseDate, setExpenseDate] = useState(today());
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<"cash" | "card">("cash");

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["expense-receipts"],
    queryFn: fetchReceipts,
  });
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["cash-expenses"],
    queryFn: fetchExpenses,
  });

  const expenseMut = useMutation({
    mutationFn: async () => {
      const amount = Number(expenseAmount.replace(",", "."));
      if (!expenseDate || !expenseName.trim() || !Number.isFinite(amount) || amount < 0) {
        throw new Error("Вкажіть дату, назву та коректну суму витрати");
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase.from("cash_expenses").insert({
        expense_date: expenseDate,
        name: expenseName.trim(),
        amount,
        payment_method: expensePaymentMethod,
        created_by: userData.user?.id ?? null,
      }).select("*").single();
      if (error) throw error;
      if (file) {
        const filePath = `${expenseDate}/${Date.now()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
          cacheControl: "3600", contentType: file.type || "application/octet-stream", upsert: false,
        });
        if (uploadError) throw uploadError;
        const { error: receiptError } = await supabase.from("expense_receipts").insert({
          expense_id: inserted.id, receipt_date: expenseDate, file_path: filePath, file_name: file.name,
          file_type: file.type || null, file_size: file.size, created_by: userData.user?.id ?? null,
        });
        if (receiptError) {
          await supabase.storage.from(BUCKET).remove([filePath]);
          throw receiptError;
        }
      }
      await logActionQuietly({ action: "create", entityType: "expense_receipt", entityId: inserted.id, entityLabel: inserted.name, summary: `Додано витрату за ${formatDate(inserted.expense_date)}`, after: inserted });
    },
    onSuccess: () => {
      toast.success("Витрату додано");
      setExpenseName("");
      setExpenseAmount("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["cash-expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-receipts"] });
      qc.invalidateQueries({ queryKey: ["cash-expenses-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteExpenseMut = useMutation({
    mutationFn: async (expense: ExpenseRow) => {
      const { error } = await supabase.from("cash_expenses").delete().eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Витрату видалено");
      qc.invalidateQueries({ queryKey: ["cash-expenses"] });
      qc.invalidateQueries({ queryKey: ["cash-expenses-dashboard"] });
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
        <h1 className="text-2xl font-semibold md:text-3xl">Витрати</h1>
        <p className="text-sm text-muted-foreground">Один запис витрати враховується в касі та PDF-звіті. Чек можна додати як підтвердження.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Витрати та каса</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)_140px_150px_auto] md:items-end">
            <div className="space-y-1.5"><Label htmlFor="expense-date">Дата</Label><Input id="expense-date" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="expense-name">На що</Label><Input id="expense-name" value={expenseName} onChange={(event) => setExpenseName(event.target.value)} placeholder="Наприклад: господарські товари" /></div>
            <div className="space-y-1.5"><Label htmlFor="expense-amount">Сума, ₴</Label><Input id="expense-amount" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} inputMode="decimal" placeholder="450" /></div>
            <div className="space-y-1.5"><Label>Оплата</Label><Select value={expensePaymentMethod} onValueChange={(value) => setExpensePaymentMethod(value as "cash" | "card")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Готівка</SelectItem><SelectItem value="card">Картка</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="expense-file">Чек (необов’язково)</Label><Input id="expense-file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
            <Button onClick={() => expenseMut.mutate()} disabled={expenseMut.isPending}><Plus className="mr-1 h-4 w-4" />{expenseMut.isPending ? "Збереження..." : "Додати витрату"}</Button>
          </div>
          {expensesLoading ? <p className="text-sm text-muted-foreground">Завантаження...</p> : expenses.length === 0 ? <p className="text-sm text-muted-foreground">Витрати ще не додані.</p> : <div className="space-y-2">{expenses.map((expense) => <div key={expense.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><div><span className="font-medium">{expense.name}</span><span className="ml-2 text-sm text-muted-foreground">{formatDate(expense.expense_date)} · {expense.payment_method === "card" ? "Картка" : "Готівка"}</span></div><div className="flex items-center gap-3"><span className="font-semibold">{formatUAH(expense.amount)}</span><Button variant="ghost" size="icon" onClick={() => deleteExpenseMut.mutate(expense)} disabled={deleteExpenseMut.isPending} title="Видалити витрату"><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Підтвердження витрат</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Завантаження...</p>
          ) : receipts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              <ReceiptText className="mx-auto mb-3 h-9 w-9" />
              <p>Поки немає доданих підтверджень</p>
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

async function fetchExpenses() {
  const { data, error } = await supabase.from("cash_expenses").select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function formatUAH(value: number | null | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString("uk-UA")} ₴`;
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
