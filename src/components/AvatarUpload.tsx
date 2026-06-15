import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  userId: string;
  name: string;
  avatarPath: string | null;
  size?: number;
}

export function AvatarUpload({ userId, name, avatarPath, size = 64 }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Kuva on liian iso (max 5 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (dbErr) throw dbErr;
      toast.success("Profiilikuva päivitetty");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["sarjataulukko"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lataus epäonnistui");
    } finally {
      setUploading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
      style={{ width: size, height: size }}
      aria-label="Vaihda profiilikuva"
    >
      <Avatar className="w-full h-full ring-2 ring-primary/40">
        {url && <AvatarImage src={url} alt={name} />}
        <AvatarFallback className="bg-primary/20 text-primary font-bold">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="absolute inset-0 rounded-full bg-black/50 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : (
          <Camera className="w-5 h-5 text-white" />
        )}
      </span>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </button>
  );
}

export function AvatarView({
  name,
  url,
  size = 32,
  ring,
}: {
  name: string;
  url: string | null;
  size?: number;
  ring?: string;
}) {
  return (
    <Avatar className={`shrink-0 ${ring ?? ""}`} style={{ width: size, height: size }}>
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="bg-muted text-xs font-bold">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// Resolve a batch of avatar paths to signed URLs.
export async function resolveAvatarUrls(paths: (string | null)[]): Promise<(string | null)[]> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return paths.map(() => null);
  const { data } = await supabase.storage.from("avatars").createSignedUrls(unique, 3600);
  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return paths.map((p) => (p ? (map.get(p) ?? null) : null));
}
