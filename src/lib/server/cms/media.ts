import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSql, iso, type Db } from "@/lib/database/db";
import type { MediaKind } from "@/lib/game-engine/types";
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase/admin";
import { audit, CmsError } from "../audit";
import type { Actor } from "../engine";

const MIME: Record<string, { kind: MediaKind; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/wav": { kind: "audio", ext: "wav" },
  "audio/x-wav": { kind: "audio", ext: "wav" },
  "audio/webm": { kind: "audio", ext: "webm" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
};
export const ALLOWED_MIME = Object.keys(MIME);
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export const mediaMetaSchema = z.object({
  label: z.string().trim().min(2).max(120),
  artist: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  licenseInfo: z.string().trim().max(1000).nullable().optional(),
  licenseConfirmed: z.boolean().default(false),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  durationMs: z.number().int().positive().max(36_000_000).nullable().optional(),
});

export interface MediaRecord {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  label: string;
  artist: string | null;
  category: string | null;
  licenseInfo: string | null;
  licenseConfirmed: boolean;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  archived: boolean;
  usedBy: number;
  createdAt: string;
}

/**
 * Passo 1 dell'upload: il browser riceve un URL firmato e carica il file
 * DIRETTAMENTE su Storage (niente limite di dimensione delle Vercel Function).
 * Il percorso è un uuid opaco: il nome del file (es. titolo di una canzone)
 * non compare mai negli URL visibili ai giocatori.
 */
export async function createUploadUrl(mimeType: string, sizeBytes: number) {
  const info = MIME[mimeType];
  if (!info) throw new CmsError(`Formato non supportato (${mimeType})`, 415);
  if (sizeBytes <= 0 || sizeBytes > MAX_MEDIA_BYTES) throw new CmsError("File troppo grande (max 50 MB)", 413);
  const path = `${info.kind}/${randomUUID()}.${info.ext}`;
  const { data, error } = await getSupabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new CmsError(`Storage non disponibile: ${error?.message ?? "errore"}`, 502);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

/** Passo 2: registra il media verificando che il file esista davvero. */
export async function registerMedia(path: string, raw: unknown, actor: Actor): Promise<MediaRecord> {
  const meta = mediaMetaSchema.parse(raw);
  if (!/^(image|audio|video)\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(path)) throw new CmsError("Percorso non valido", 422);
  const folder = path.split("/")[0];
  const name = path.split("/")[1];
  const { data, error } = await getSupabaseAdmin().storage.from(MEDIA_BUCKET).list(folder, { search: name, limit: 1 });
  const obj = data?.find((o) => o.name === name);
  if (error || !obj) throw new CmsError("File non trovato su Storage: ripeti il caricamento", 422);
  const mime = (obj.metadata?.mimetype as string | undefined) ?? "";
  const size = Number(obj.metadata?.size ?? 0);
  const info = MIME[mime];
  if (!info || info.kind !== folder) throw new CmsError("Tipo di file non coerente", 422);
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into media_assets (kind, storage_path, mime_type, size_bytes, label, artist, category, license_info,
        license_confirmed, width, height, duration_ms, created_by)
      values (${info.kind}, ${path}, ${mime}, ${size}, ${meta.label}, ${meta.artist ?? null}, ${meta.category ?? null},
        ${meta.licenseInfo ?? null}, ${meta.licenseConfirmed}, ${meta.width ?? null}, ${meta.height ?? null},
        ${meta.durationMs ?? null}, ${actor.userId})
      returning id`;
    await audit(tx, actor, "media.upload", { type: "media", id: row.id, details: { kind: info.kind, size } });
    return (await getMedia(tx, row.id))!;
  });
}

export async function getMedia(db: Db, id: string): Promise<MediaRecord | null> {
  const [r] = await db<
    {
      id: string;
      kind: MediaKind;
      mime_type: string;
      size_bytes: number;
      label: string;
      artist: string | null;
      category: string | null;
      license_info: string | null;
      license_confirmed: boolean;
      width: number | null;
      height: number | null;
      duration_ms: number | null;
      archived: boolean;
      used_by: number;
      created_at: Date;
    }[]
  >`
    select m.*, (select count(*)::int from question_bank q where q.media_id = m.id) as used_by
    from media_assets m where m.id = ${id}`;
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    label: r.label,
    artist: r.artist,
    category: r.category,
    licenseInfo: r.license_info,
    licenseConfirmed: r.license_confirmed,
    width: r.width,
    height: r.height,
    durationMs: r.duration_ms,
    archived: r.archived,
    usedBy: r.used_by,
    createdAt: iso(r.created_at)!,
  };
}

export async function listMedia(f: { kind?: MediaKind; search?: string; category?: string; includeArchived?: boolean }): Promise<MediaRecord[]> {
  const sql = getSql();
  const ids = await sql<{ id: string }[]>`
    select id from media_assets
    where (${f.kind ?? null}::media_kind is null or kind = ${f.kind ?? null}::media_kind)
      and (${f.includeArchived ?? false}::boolean or not archived)
      and (${f.search ?? null}::text is null or label ilike ${"%" + (f.search ?? "") + "%"} or artist ilike ${"%" + (f.search ?? "") + "%"})
      and (${f.category ?? null}::text is null or category = ${f.category ?? null})
    order by created_at desc limit 300`;
  const out: MediaRecord[] = [];
  for (const { id } of ids) {
    const m = await getMedia(sql, id);
    if (m) out.push(m);
  }
  return out;
}

export async function updateMedia(id: string, raw: unknown, actor: Actor): Promise<MediaRecord> {
  const meta = mediaMetaSchema.partial().extend({ archived: z.boolean().optional() }).parse(raw);
  const sql = getSql();
  return sql.begin(async (tx) => {
    const cur = await getMedia(tx, id);
    if (!cur) throw new CmsError("Media non trovato", 404);
    await tx`
      update media_assets set
        label = ${meta.label ?? cur.label}, artist = ${meta.artist === undefined ? cur.artist : meta.artist},
        category = ${meta.category === undefined ? cur.category : meta.category},
        license_info = ${meta.licenseInfo === undefined ? cur.licenseInfo : meta.licenseInfo},
        license_confirmed = ${meta.licenseConfirmed ?? cur.licenseConfirmed},
        duration_ms = ${meta.durationMs === undefined ? cur.durationMs : meta.durationMs},
        archived = ${meta.archived ?? cur.archived}
      where id = ${id}`;
    await audit(tx, actor, "media.update", { type: "media", id, details: meta as Record<string, unknown> });
    return (await getMedia(tx, id))!;
  });
}

/** URL firmato a breve scadenza (i file restano privati). */
export async function signedMediaUrl(db: Db, mediaId: string, ttlSeconds = 600): Promise<string | null> {
  const [m] = await db<{ storage_path: string }[]>`select storage_path from media_assets where id = ${mediaId}`;
  if (!m) return null;
  const { data, error } = await getSupabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUrl(m.storage_path, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
