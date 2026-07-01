import { ChangeEvent, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CLIENT_PHOTOS_BUCKET = "client-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export function ClientPhotoUpload({
  clientId,
  childName,
  photoUrl,
  className,
}: {
  clientId: string;
  childName: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const invalidateClient = () => {
    qc.invalidateQueries({ queryKey: ["client", clientId] });
    qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
  };

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) {
        throw new Error("Оберіть файл зображення");
      }

      if (file.size > MAX_PHOTO_SIZE) {
        throw new Error("Фото має бути до 5 МБ");
      }

      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(CLIENT_PHOTOS_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(CLIENT_PHOTOS_BUCKET).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("clients")
        .update({ photo_url: data.publicUrl })
        .eq("id", clientId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Фото збережено");
      invalidateClient();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").update({ photo_url: null }).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Фото прибрано");
      invalidateClient();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) uploadMut.mutate(file);
  };

  const isBusy = uploadMut.isPending || removeMut.isPending;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative aspect-square w-full overflow-hidden rounded-md border bg-muted">
        {photoUrl ? (
          <img src={photoUrl} alt={childName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs">Фото клієнта</span>
          </div>
        )}
        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" disabled={isBusy} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" />
          Завантажити
        </Button>
        {photoUrl && (
          <Button type="button" variant="ghost" size="icon" disabled={isBusy} onClick={() => removeMut.mutate()} aria-label="Прибрати фото">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
