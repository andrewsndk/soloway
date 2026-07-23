import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { formatVisitNote } from "@/lib/visit-note-ai";

export function VisitNoteEditor({
  rawNote,
  parentSummary,
  childName,
  visitDate,
  format,
  disabled,
  onRawNoteChange,
  onParentSummaryChange,
}: {
  rawNote: string;
  parentSummary: string;
  childName?: string | null;
  visitDate?: string | null;
  format?: string | null;
  disabled?: boolean;
  onRawNoteChange: (value: string) => void;
  onParentSummaryChange: (value: string) => void;
}) {
  const [formatting, setFormatting] = useState(false);

  const handleCopy = async () => {
    if (!parentSummary.trim()) {
      toast.error("Спочатку оформіть або напишіть повідомлення для батьків.");
      return;
    }

    try {
      await navigator.clipboard.writeText(parentSummary);
      toast.success("Текст скопійовано");
    } catch {
      toast.error("Не вдалося скопіювати текст.");
    }
  };

  const handleFormat = async () => {
    try {
      setFormatting(true);
      const summary = await formatVisitNote({
        rawNote,
        childName,
        visitDate,
        format,
      });
      onParentSummaryChange(summary);
      toast.success("Повідомлення для батьків оформлено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося оформити текст.");
    } finally {
      setFormatting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Внутрішня нотатка вихователя</Label>
        <VoiceTextarea
          rows={5}
          value={rawNote}
          onChange={onRawNoteChange}
          placeholder="Наприклад: малювала фарбами, грала з конструктором, зацікавилась сенсорними іграми..."
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
        <div>
          <div className="text-sm font-medium">Повідомлення для батьків</div>
          <div className="text-xs text-muted-foreground">
            AI оформить нотатку в теплому стилі Soloway для повідомлення в чат. Перед збереженням її можна відредагувати.
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFormat}
          disabled={disabled || formatting || !rawNote.trim()}
        >
          <Sparkles className="mr-1 h-4 w-4" />
          {formatting ? "Оформлення..." : "Оформити для батьків"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {parentSummary.trim() ? `${parentSummary.length} символів` : "Текст повідомлення з'явиться нижче."}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={disabled || !parentSummary.trim()}
          >
            <Copy className="mr-1 h-4 w-4" />
            Копіювати
          </Button>
        </div>
        <Textarea
          rows={12}
          value={parentSummary}
          onChange={(event) => onParentSummaryChange(event.target.value)}
          placeholder="Тут з'явиться тепле повідомлення для батьків після AI-оформлення."
          disabled={disabled}
          className="max-h-[420px] min-h-[320px] resize-y overflow-y-auto leading-7"
        />
      </div>
    </div>
  );
}
