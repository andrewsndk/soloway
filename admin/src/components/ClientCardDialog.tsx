import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fetchSettings, formatLabel } from "@/lib/settings";
import { formatDate, formatTime, formatUAH } from "@/lib/pricing";
import { ClientPhotoUpload } from "@/components/ClientPhotoUpload";
import { Edit3, ExternalLink, ImageIcon, Save, X } from "lucide-react";
import { toast } from "sonner";

export function ClientCardDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [editing, setEditing] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    enabled: !!clientId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["client-bookings", clientId],
    enabled: !!clientId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings").select("*").eq("client_id", clientId!)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    parent_name: "", child_name: "", phone: "", who_can_pickup: "",
    child_birthdate: "", parent_questionnaire: "", admin_comment: "", teacher_comment: "",
  });

  useEffect(() => {
    if (client && !editing) {
      setForm({
        parent_name: client.parent_name ?? "",
        child_name: client.child_name ?? "",
        phone: client.phone ?? "",
        who_can_pickup: client.who_can_pickup ?? "",
        child_birthdate: client.child_birthdate ?? "",
        parent_questionnaire: client.parent_questionnaire ?? "",
        admin_comment: client.admin_comment ?? "",
        teacher_comment: client.teacher_comment ?? "",
      });
    }
  }, [client, editing]);

  useEffect(() => {
    if (open) setEditing(false);
  }, [open, clientId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!clientId) return;
      const { error } = await supabase.from("clients").update({
        ...form,
        child_birthdate: form.child_birthdate || null,
        phone: form.phone || null,
      }).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Збережено");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = (bookings ?? []).reduce(
    (acc, b) => {
      acc.count += 1;
      if (b.status !== "Скасовано") acc.total += Number(b.amount || 0);
      if (!acc.first || b.visit_date < acc.first) acc.first = b.visit_date;
      if (!acc.last || b.visit_date > acc.last) acc.last = b.visit_date;
      return acc;
    },
    { count: 0, total: 0, first: "", last: "" },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? client.child_name : "Картка клієнта"}
          </DialogTitle>
          <DialogDescription>
            {client ? `Батьки: ${client.parent_name}` : "Завантаження…"}
          </DialogDescription>
        </DialogHeader>

        {client && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              {editing ? (
                <ClientPhotoUpload clientId={client.id} childName={client.child_name} photoUrl={client.photo_url} />
              ) : (
                <ClientPhotoPreview childName={client.child_name} photoUrl={client.photo_url} />
              )}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Відвідувань" value={stats.count} />
                <Stat label="Витрачено" value={formatUAH(stats.total)} />
                <Stat label="Перший візит" value={stats.first ? formatDate(stats.first) : "—"} />
                <Stat label="Останній візит" value={stats.last ? formatDate(stats.last) : "—"} />
              </div>
            </div>

            {editing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Ім'я батьків"><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></F>
                <F label="Ім'я дитини"><Input value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })} /></F>
                <F label="Телефон"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
                <F label="Дата народження дитини"><Input type="date" value={form.child_birthdate} onChange={(e) => setForm({ ...form, child_birthdate: e.target.value })} /></F>
                <F label="Хто має право забирати дитину" className="md:col-span-2"><Input value={form.who_can_pickup} onChange={(e) => setForm({ ...form, who_can_pickup: e.target.value })} /></F>
                <F label="Анкета від батьків" className="md:col-span-2"><Textarea rows={3} value={form.parent_questionnaire} onChange={(e) => setForm({ ...form, parent_questionnaire: e.target.value })} /></F>
                <F label="Коментар від адміна"><Textarea rows={2} value={form.admin_comment} onChange={(e) => setForm({ ...form, admin_comment: e.target.value })} /></F>
                <F label="Коментар вихователя"><Textarea rows={2} value={form.teacher_comment} onChange={(e) => setForm({ ...form, teacher_comment: e.target.value })} /></F>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Ім'я батьків" value={client.parent_name} />
                <Info label="Ім'я дитини" value={client.child_name} />
                <Info label="Телефон" value={client.phone} />
                <Info label="Дата народження дитини" value={client.child_birthdate ? formatDate(client.child_birthdate) : null} />
                <Info label="Хто має право забирати дитину" value={client.who_can_pickup} className="md:col-span-2" />
                <Info label="Анкета від батьків" value={client.parent_questionnaire} className="md:col-span-2" multiline />
                <Info label="Коментар від адміна" value={client.admin_comment} multiline />
                <Info label="Коментар вихователя" value={client.teacher_comment} multiline />
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-medium">Історія відвідувань</div>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Час</TableHead>
                        <TableHead>Формат</TableHead>
                        <TableHead>Годин</TableHead>
                        <TableHead className="text-right">Сума</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(bookings ?? []).length === 0 && (
                        <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Поки що немає візитів</TableCell></TableRow>
                      )}
                      {(bookings ?? []).map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>{formatDate(b.visit_date)}</TableCell>
                          <TableCell>{formatTime(b.visit_time)}</TableCell>
                          <TableCell>{settings ? formatLabel(settings.formats, b.format) : b.format}</TableCell>
                          <TableCell>{b.hours ?? "—"}</TableCell>
                          <TableCell className="text-right">{formatUAH(b.amount)}</TableCell>
                          <TableCell><Badge variant={b.status === "Скасовано" ? "destructive" : "secondary"}>{b.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {clientId && (
            <Button variant="outline" asChild>
              <Link to="/clients/$id" params={{ id: clientId }} onClick={() => onOpenChange(false)}>
                <ExternalLink className="mr-1 h-4 w-4" />Відкрити повну сторінку
              </Link>
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saveMut.isPending}>
                <X className="mr-1 h-4 w-4" />Скасувати
              </Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !client}>
                <Save className="mr-1 h-4 w-4" />{saveMut.isPending ? "Збереження…" : "Зберегти"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)} disabled={!client}>
              <Edit3 className="mr-1 h-4 w-4" />Редагувати
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientPhotoPreview({ childName, photoUrl }: { childName: string; photoUrl?: string | null }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-md border bg-muted">
      {photoUrl ? (
        <img src={photoUrl} alt={childName} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <span className="text-xs">Без фото</span>
        </div>
      )}
    </div>
  );
}

function Info({
  label,
  value,
  className,
  multiline,
}: {
  label: string;
  value?: React.ReactNode;
  className?: string;
  multiline?: boolean;
}) {
  return (
    <div className={`rounded-md border bg-muted/30 p-3 ${className ?? ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-medium ${multiline ? "whitespace-pre-wrap leading-6" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-base font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
