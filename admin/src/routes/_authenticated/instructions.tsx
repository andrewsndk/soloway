import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, FolderOpen, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import { compactDiff, logActionQuietly } from "@/lib/audit";

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
    mutationFn: async () => {
      const before = data ?? DEFAULT_SETTINGS;
      await saveSettings(settings);
      await logActionQuietly({
        action: "update",
        entityType: "instructions",
        entityId: role,
        entityLabel: ROLE_LABELS[role],
        summary: `Оновлено інструкції: ${ROLE_LABELS[role]}`,
        before: compactDiff(before.instructions, settings.instructions),
        after: settings.instructions,
      });
    },
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
  const folders = parseInstructionFolders(text);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const addInstruction = () => {
    const title = newTitle.trim();
    const body = newBody.trim();

    if (!title) {
      toast.error("Додайте назву інструкції");
      return;
    }

    const nextBlock = `## ${title}\n\n${body || "Опишіть інструкцію тут..."}`;
    onChange([text.trim(), nextBlock].filter(Boolean).join("\n\n"));
    setNewTitle("");
    setNewBody("");
    toast.success("Інструкцію додано. Не забудьте зберегти зміни.");
  };

  return (
    <TabsContent value={role}>
      <Card>
        <CardHeader>
          <CardTitle>{ROLE_LABELS[role]}</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/20 p-4">
                <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`${role}-instruction-title`}>Назва інструкції</Label>
                    <Input
                      id={`${role}-instruction-title`}
                      value={newTitle}
                      onChange={(event) => setNewTitle(event.target.value)}
                      placeholder="Наприклад: Робота з CRM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${role}-instruction-body`}>Короткий текст</Label>
                    <Textarea
                      id={`${role}-instruction-body`}
                      rows={3}
                      value={newBody}
                      onChange={(event) => setNewBody(event.target.value)}
                      placeholder="Додайте пункти інструкції. Можна дописати деталі нижче в основному тексті."
                    />
                  </div>
                  <Button type="button" onClick={addInstruction}>
                    <Plus className="mr-1 h-4 w-4" />
                    Додати
                  </Button>
                </div>
              </div>

              <Textarea
                rows={18}
                value={text}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Додайте робочі інструкції, правила, чеклісти або сценарії для співробітників..."
              />
            </div>
          ) : folders.length > 0 ? (
            <Accordion type="multiple" className="space-y-3">
              {folders.map((folder) => (
                <AccordionItem
                  key={`${role}-${folder.title}`}
                  value={folder.title}
                  className="rounded-md border bg-background px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      {folder.title}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <InstructionContent lines={folder.lines} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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

type InstructionFolder = {
  title: string;
  lines: string[];
};

function parseInstructionFolders(text: string): InstructionFolder[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const folders: InstructionFolder[] = [];
  let current: InstructionFolder | null = null;

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      current = { title: line.replace(/^##\s+/, "").trim(), lines: [] };
      folders.push(current);
      return;
    }

    if (!current) {
      current = { title: "Робота з CRM", lines: [] };
      folders.push(current);
    }

    current.lines.push(line);
  });

  return folders.filter((folder) => folder.lines.length > 0);
}

function InstructionContent({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-4">
      {lines.map((line, index) => {
        const sectionMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (sectionMatch) {
          return (
            <div key={`${line}-${index}`} className="pt-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                <span>{sectionMatch[1]}</span>
                <span>{sectionMatch[2]}</span>
              </div>
            </div>
          );
        }

        if (index === 0) {
          return (
            <p key={`${line}-${index}`} className="text-base font-medium leading-7 text-foreground">
              {line}
            </p>
          );
        }

        return (
          <div key={`${line}-${index}`} className="flex gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm leading-6">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
            <p>{line}</p>
          </div>
        );
      })}
    </div>
  );
}
