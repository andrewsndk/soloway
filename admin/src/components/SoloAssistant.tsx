import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lightbulb, MessageCircleQuestion, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchSoloInsight, type SoloInsightResult } from "@/lib/solo";
import { toast } from "sonner";

function useSoloInsight(clientId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["solo-insight", clientId],
    queryFn: () => fetchSoloInsight(clientId!),
    enabled: Boolean(clientId) && enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function SoloAssistantCard({
  clientId,
  childName,
}: {
  clientId: string | null | undefined;
  childName?: string | null;
}) {
  const query = useSoloInsight(clientId, true);
  if (!clientId) return null;

  return (
    <section className="rounded-md border border-amber-200 bg-amber-50/40 p-4">
      <SoloHeader
        clientId={clientId}
        childName={childName}
        data={query.data}
        loading={query.isLoading}
      />
      <div className="mt-3">
        <SoloBody
          data={query.data}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        />
      </div>
    </section>
  );
}

export function SoloAssistantButton({
  clientId,
  childName,
}: {
  clientId: string | null | undefined;
  childName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const query = useSoloInsight(clientId, open);
  if (!clientId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-700"
                aria-label="Підказки СОЛО"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Підказки СОЛО</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="start" className="w-[min(380px,calc(100vw-2rem))] p-4">
        <SoloHeader
          clientId={clientId}
          childName={childName}
          data={query.data}
          loading={query.isLoading}
        />
        <div className="mt-3">
          <SoloBody
            data={query.data}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SoloHeader({
  clientId,
  childName,
  data,
  loading,
}: {
  clientId: string;
  childName?: string | null;
  data?: SoloInsightResult;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const regenerate = useMutation({
    mutationFn: () => fetchSoloInsight(clientId, true),
    onSuccess: (result) => qc.setQueryData(["solo-insight", clientId], result),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-700" />
          <span>СОЛО{childName ? ` · ${childName}` : ""}</span>
        </div>
        {data?.status === "ready" ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            На основі {data.sourceCount} {visitWord(data.sourceCount)}
          </div>
        ) : null}
      </div>
      {data?.status === "ready" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => regenerate.mutate()}
                disabled={loading || regenerate.isPending}
                aria-label="Оновити підказки СОЛО"
              >
                <RefreshCw className={`h-4 w-4 ${regenerate.isPending ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Оновити підказки</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

function SoloBody({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: SoloInsightResult;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
        <span>{error.message}</span>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Повторити
        </Button>
      </div>
    );
  }

  if (!data || data.status === "empty") {
    return (
      <p className="text-sm text-muted-foreground">
        Ще немає готових текстів із попередніх візитів.
      </p>
    );
  }

  const fields = [
    { label: "Пам'ятати", value: data.insight.remember, icon: Sparkles, tone: "text-amber-700" },
    {
      label: "Запитати",
      value: data.insight.ask,
      icon: MessageCircleQuestion,
      tone: "text-sky-700",
    },
    {
      label: "Запропонувати",
      value: data.insight.activity,
      icon: Lightbulb,
      tone: "text-emerald-700",
    },
  ].filter((field) => field.value);

  return (
    <div className="space-y-3">
      {fields.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-sm">
          <Icon className={`mt-0.5 h-4 w-4 ${tone}`} />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
            <div className="mt-0.5 break-words leading-relaxed">{value}</div>
          </div>
        </div>
      ))}
      {data.insight.watchOut ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" />
            <span className="text-xs font-semibold uppercase">Звернути увагу</span>
            <Badge variant="outline" className="ml-auto border-red-200 text-red-800">
              Внутрішньо
            </Badge>
          </div>
          <div className="mt-1.5 break-words leading-relaxed">{data.insight.watchOut}</div>
        </div>
      ) : null}
    </div>
  );
}

function visitWord(count: number) {
  if (count === 1) return "візиту";
  if (count >= 2 && count <= 4) return "візитів";
  return "візитів";
}
