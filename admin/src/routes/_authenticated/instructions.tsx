import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

type InstructionRole = "administrator" | "teacher";

const ROLE_LABELS: Record<InstructionRole, string> = {
  administrator: "Адміністратор",
  teacher: "Вихователь",
};

export const Route = createFileRoute("/_authenticated/instructions")({
  head: () => ({ meta: [{ title: "Інструкції — Soloway CRM" }] }),
  component: InstructionsPage,
});

function InstructionsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [role, setRole] = useState<InstructionRole>("administrator");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => saveSettings(settings),
    onSuccess: () => {
      toast.success("Інструкції збережено");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setInstruction = (item: InstructionRole, value: string) => {
    setSettings({
      ...settings,
      instructions: {
        ...settings.instructions,
        [item]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Інструкції</h1>
          <p className="text-sm text-muted-foreground">Внутрішні робочі правила для команди</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((v) => !v)}>
            <Edit3 className="mr-1 h-4 w-4" />
            {editing ? "Перегляд" : "Редагувати"}
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing}>
            <Save className="mr-1 h-4 w-4" />
            {saveMut.isPending ? "Збереження…" : "Зберегти"}
          </Button>
        </div>
      </div>

      <Tabs value={role} onValueChange={(value) => setRole(value as InstructionRole)}>
        <TabsList>
          <TabsTrigger value="administrator">Для адміністратора</TabsTrigger>
          <TabsTrigger value="teacher">Для вихователя</TabsTrigger>
        </TabsList>

        {(["administrator", "teacher"] as InstructionRole[]).map((item) => (
          <InstructionPane
            key={item}
            role={item}
            text={settings.instructions[item] ?? ""}
            editing={editing}
            onChange={(value) => setInstruction(item, value)}
          />
        ))}
      </Tabs>
    </div>
  );
}

function InstructionPane({
  role,
  text,
  editing,
  onChange,
}: {
  role: InstructionRole;
  text: string;
  editing: boolean;
  onChange: (value: string) => void;
}) {
  const paragraphs = text.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <TabsContent value={role}>
      <Card>
        <CardHeader>
          <CardTitle>{ROLE_LABELS[role]}</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Textarea
              rows={18}
              value={text}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Додайте робочі інструкції, правила, чеклісти або сценарії для співробітників..."
            />
          ) : paragraphs.length > 0 ? (
            <div className="space-y-3 whitespace-pre-wrap text-sm leading-6">
              {paragraphs.map((paragraph, index) => (
                <p key={`${role}-${index}`}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Інструкції для цієї ролі ще не додані.
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
