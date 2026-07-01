import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClientPhotoUpload } from "@/components/ClientPhotoUpload";
import { fetchSettings, formatLabel } from "@/lib/settings";
import { formatDate, formatTime, formatUAH } from "@/lib/pricing";
import { ArrowLeft, Edit3, ImageIcon, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({ meta: [{ title: "Профіль клієнта — Soloway CRM" }] }),
  component: ClientPage,
});

function ClientPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [editing, setEditing] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["client-bookings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings").select("*").eq("client_id", id)
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

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").update({
        ...form,
        child_birthdate: form.child_birthdate || null,
        phone: form.phone || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Збережено");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Картку видалено");
      navigate({ to: "/clients" });
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

  if (!client) {
    return <div className="text-muted-foreground">Завантаження…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/clients" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> До списку
        </Link>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="mr-1 h-4 w-4" />Видалити картку</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Видалити клієнта?</AlertDialogTitle>
              <AlertDialogDescription>Бронювання залишаться, але без прив'язки до картки.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Скасувати</AlertDialogCancel>
              <AlertDialogAction onClick={() => delMut.mutate()}>Видалити</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{client.child_name}</h1>
        <p className="text-sm text-muted-foreground">Батьки: {client.parent_name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Stat label="Відвідувань" value={stats.count} />
        <Stat label="Витрачено" value={formatUAH(stats.total)} />
        <Stat label="Перший візит" value={stats.first ? formatDate(stats.first) : "—"} />
        <Stat label="Останній візит" value={stats.last ? formatDate(stats.last) : "—"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Картка клієнта</CardTitle>
          {editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saveMut.isPending}>
              <X className="mr-1 h-4 w-4" />Скасувати
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Edit3 className="mr-1 h-4 w-4" />Редагувати
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
            {editing ? (
              <ClientPhotoUpload clientId={client.id} childName={client.child_name} photoUrl={client.photo_url} />
            ) : (
              <ClientPhotoPreview childName={client.child_name} photoUrl={client.photo_url} />
            )}
            {editing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Ім'я батьків"><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></F>
                <F label="Ім'я дитини"><Input value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })} /></F>
                <F label="Телефон"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
                <F label="Дата народження дитини"><Input type="date" value={form.child_birthdate} onChange={(e) => setForm({ ...form, child_birthdate: e.target.value })} /></F>
                <F label="Хто має право забирати дитину" className="md:col-span-2"><Input value={form.who_can_pickup} onChange={(e) => setForm({ ...form, who_can_pickup: e.target.value })} /></F>
                <F label="Анкета від батьків" className="md:col-span-2"><Textarea rows={4} value={form.parent_questionnaire} onChange={(e) => setForm({ ...form, parent_questionnaire: e.target.value })} /></F>
                <F label="Коментар від адміна"><Textarea rows={3} value={form.admin_comment} onChange={(e) => setForm({ ...form, admin_comment: e.target.value })} /></F>
                <F label="Коментар вихователя"><Textarea rows={3} value={form.teacher_comment} onChange={(e) => setForm({ ...form, teacher_comment: e.target.value })} /></F>
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                    <Save className="mr-1 h-4 w-4" />{saveMut.isPending ? "Збереження…" : "Зберегти"}
                  </Button>
                </div>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Історія відвідувань</CardTitle></CardHeader>
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
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
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
