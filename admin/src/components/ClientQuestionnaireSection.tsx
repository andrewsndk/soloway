import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_QUESTIONNAIRE_GROUPS,
  type ClientQuestionnaireKey,
} from "@/lib/client-questionnaire";

type QuestionnaireForm = Record<ClientQuestionnaireKey, string>;
type QuestionnaireClient = Partial<Record<ClientQuestionnaireKey, string | null>>;

export function ClientQuestionnaireEditor({
  form,
  onFieldChange,
}: {
  form: QuestionnaireForm;
  onFieldChange: (key: ClientQuestionnaireKey, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {CLIENT_QUESTIONNAIRE_GROUPS.map((group) => (
        <div key={group.title} className="rounded-md border bg-muted/20 p-3">
          <div className="mb-3 text-sm font-semibold">{group.title}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {group.fields.map((field) => (
              <div key={field.key} className={field.rows && field.rows > 2 ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
                <Label>{field.label}</Label>
                {field.rows ? (
                  <Textarea
                    rows={field.rows}
                    value={form[field.key]}
                    onChange={(event) => onFieldChange(field.key, event.target.value)}
                  />
                ) : (
                  <Input
                    value={form[field.key]}
                    onChange={(event) => onFieldChange(field.key, event.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClientQuestionnaireView({ client }: { client: QuestionnaireClient }) {
  return (
    <div className="space-y-3">
      {CLIENT_QUESTIONNAIRE_GROUPS.map((group) => (
        <div key={group.title} className="rounded-md border bg-muted/20 p-3">
          <div className="mb-3 text-sm font-semibold">{group.title}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {group.fields.map((field) => (
              <div key={field.key} className={field.rows && field.rows > 2 ? "md:col-span-2" : ""}>
                <div className="text-xs text-muted-foreground">{field.label}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6">
                  {client[field.key] || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
