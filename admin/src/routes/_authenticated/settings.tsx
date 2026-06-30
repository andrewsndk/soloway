import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Налаштування — Soloway CRM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => { if (data) setS(data); }, [data]);

  const mut = useMutation({
    mutationFn: () => saveSettings(s),
    onSuccess: () => { toast.success("Налаштування збережено"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setTariff = (k: keyof AppSettings["tariffs"], v: string) =>
    setS({ ...s, tariffs: { ...s.tariffs, [k]: Number(v) || 0 } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Налаштування</h1>
        <p className="text-sm text-muted-foreground">Тарифи, формати, джерела заявок і додаткові послуги</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Тарифи</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Tariff label="На 1 годину, ₴" value={s.tariffs.hour_1} onChange={(v) => setTariff("hour_1", v)} />
          <Tariff label="На 3 години, ₴" value={s.tariffs.hour_3} onChange={(v) => setTariff("hour_3", v)} />
          <Tariff label="Повний день, ₴" value={s.tariffs.full_day} onChange={(v) => setTariff("full_day", v)} />
          <Tariff label="Адаптація, ₴" value={s.tariffs.adaptation} onChange={(v) => setTariff("adaptation", v)} />
          <Tariff label="Інша к-ть годин: тариф за годину (до 3-х), ₴" value={s.tariffs.extra_per_hour} onChange={(v) => setTariff("extra_per_hour", v)} />
          <Tariff label="Інша к-ть годин: тариф за годину понад 3-тю, ₴" value={s.tariffs.extra_per_hour_above3} onChange={(v) => setTariff("extra_per_hour_above3", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Списки</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ListEditor label="Джерела заявок" items={s.sources} onChange={(v) => setS({ ...s, sources: v })} />
          <ListEditor label="Додаткові послуги" items={s.extra_services} onChange={(v) => setS({ ...s, extra_services: v })} />
          <ListEditor label="Статуси" items={s.statuses} onChange={(v) => setS({ ...s, statuses: v })} />
          <div>
            <Label className="mb-2 block">Формати відвідування</Label>
            <div className="space-y-2">
              {s.formats.map((f, i) => (
                <div key={f.key} className="flex gap-2">
                  <Input className="w-32" value={f.key} disabled />
                  <Input
                    value={f.label}
                    onChange={(e) => {
                      const next = [...s.formats];
                      next[i] = { ...f, label: e.target.value };
                      setS({ ...s, formats: next });
                    }}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Ключі форматів змінювати не можна — вони використовуються в логіці розрахунку.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Збереження…" : "Зберегти налаштування"}
        </Button>
      </div>
    </div>
  );
}

function Tariff({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        rows={Math.max(items.length + 1, 4)}
        value={items.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
      />
      <p className="text-xs text-muted-foreground">Один пункт на рядок.</p>
    </div>
  );
}