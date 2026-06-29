import { supabase } from "./supabase";
import { deleteFromStorage, uploadToStorage } from "./storage";

export type PanelLabelRegion = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export type PanelLabelPanel = {
  id: string;
  regionId: string;
  name: string;
  sortOrder: number;
  notes: string;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  createdAt: string;
};

export type PanelLabelPanelSummary = PanelLabelPanel & {
  tekHatCount: number;
  panoIciCount: number;
  tekHatCoverPath: string | null;
  tekHatCoverMime: string | null;
  panoIciCoverPath: string | null;
  panoIciCoverMime: string | null;
};

export type PanelLabelImageCategory = "tek_hat" | "pano_ici";

export type PanelLabelImage = {
  id: string;
  panelId: string;
  category: PanelLabelImageCategory;
  title: string;
  storagePath: string;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
};

type DbRegion = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

type DbPanel = {
  id: string;
  region_id: string;
  name: string;
  sort_order: number;
  notes: string | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  created_at: string;
};

type DbImage = {
  id: string;
  panel_id: string;
  category: PanelLabelImageCategory;
  title: string;
  storage_path: string;
  mime_type: string;
  sort_order: number;
  created_at: string;
};

async function resolveUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? "shared";
}

function mapRegion(row: DbRegion): PanelLabelRegion {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapPanel(row: DbPanel): PanelLabelPanel {
  return {
    id: row.id,
    regionId: row.region_id,
    name: row.name,
    sortOrder: row.sort_order,
    notes: row.notes ?? "",
    widthCm: row.width_cm,
    heightCm: row.height_cm,
    depthCm: row.depth_cm,
    createdAt: row.created_at,
  };
}

export function isPanelAssetPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export function isAcceptablePanelAssetFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}

export function panelAssetMimeType(file: File): string {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  return "image/jpeg";
}

export function formatPanelDimensions(
  widthCm: number | null,
  heightCm: number | null,
  depthCm: number | null,
): string | null {
  const parts: string[] = [];
  if (widthCm != null) parts.push(`W ${widthCm}`);
  if (heightCm != null) parts.push(`H ${heightCm}`);
  if (depthCm != null) parts.push(`D ${depthCm}`);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} cm`;
}

function mapImage(row: DbImage): PanelLabelImage {
  return {
    id: row.id,
    panelId: row.panel_id,
    category: row.category,
    title: row.title,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listRegions(): Promise<PanelLabelRegion[]> {
  const { data, error } = await supabase
    .from("panel_label_regions")
    .select("id, name, sort_order, created_at")
    .eq("visible", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbRegion[]).map(mapRegion);
}

export function compareRegionNames(a: string, b: string): number {
  return a.localeCompare(b, "tr", { sensitivity: "base" });
}

const ALPHA_SORT_KEY = "koryon-panel-regions-alpha-sorted";

export async function ensureRegionsAlphabeticalSort(): Promise<void> {
  if (localStorage.getItem(ALPHA_SORT_KEY) === "1") return;

  const regions = await listRegions();
  if (regions.length === 0) {
    localStorage.setItem(ALPHA_SORT_KEY, "1");
    return;
  }

  const sorted = [...regions].sort((a, b) =>
    compareRegionNames(a.name, b.name),
  );
  await reorderRegions(sorted.map((r) => r.id));
  localStorage.setItem(ALPHA_SORT_KEY, "1");
}

export async function reorderRegions(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("panel_label_regions")
        .update({ sort_order: index })
        .eq("id", id),
    ),
  );

  for (const result of results) {
    if (result.error) throw new Error(result.error.message);
  }
}

export async function getRegion(id: string): Promise<PanelLabelRegion | null> {
  const { data, error } = await supabase
    .from("panel_label_regions")
    .select("id, name, sort_order, created_at")
    .eq("id", id)
    .eq("visible", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRegion(data as DbRegion) : null;
}

export async function createRegion(name: string): Promise<PanelLabelRegion> {
  const userId = await resolveUserId();
  const regions = await listRegions();
  const sortOrder =
    regions.length === 0 ? 0 : Math.max(...regions.map((r) => r.sortOrder)) + 1;

  const { data, error } = await supabase
    .from("panel_label_regions")
    .insert({ name: name.trim(), sort_order: sortOrder, user_id: userId })
    .select("id, name, sort_order, created_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Bölge oluşturulamadı");
  return mapRegion(data as DbRegion);
}

export async function updateRegionName(
  id: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from("panel_label_regions")
    .update({ name: name.trim() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteRegion(id: string): Promise<void> {
  const { error } = await supabase
    .from("panel_label_regions")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

const PANEL_SELECT =
  "id, region_id, name, sort_order, notes, width_cm, height_cm, depth_cm, created_at";

export async function listPanels(regionId: string): Promise<PanelLabelPanel[]> {
  const { data, error } = await supabase
    .from("panel_label_panels")
    .select(PANEL_SELECT)
    .eq("region_id", regionId)
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbPanel[]).map(mapPanel);
}

export async function listPanelsWithSummary(
  regionId: string,
): Promise<PanelLabelPanelSummary[]> {
  const panels = await listPanels(regionId);
  if (panels.length === 0) return [];

  const panelIds = panels.map((p) => p.id);
  const { data, error } = await supabase
    .from("panel_label_images")
    .select("panel_id, category, storage_path, mime_type, sort_order, created_at")
    .in("panel_id", panelIds)
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  type Row = {
    panel_id: string;
    category: PanelLabelImageCategory;
    storage_path: string;
    mime_type: string;
  };

  const byPanel = new Map<
    string,
    {
      tekHat: Row[];
      panoIci: Row[];
    }
  >();

  for (const panelId of panelIds) {
    byPanel.set(panelId, { tekHat: [], panoIci: [] });
  }

  for (const row of (data ?? []) as Row[]) {
    const bucket = byPanel.get(row.panel_id);
    if (!bucket) continue;
    if (row.category === "tek_hat") bucket.tekHat.push(row);
    else bucket.panoIci.push(row);
  }

  return panels.map((panel) => {
    const assets = byPanel.get(panel.id) ?? { tekHat: [], panoIci: [] };
    const tekCover = assets.tekHat[0] ?? null;
    const panoCover = assets.panoIci[0] ?? null;
    return {
      ...panel,
      tekHatCount: assets.tekHat.length,
      panoIciCount: assets.panoIci.length,
      tekHatCoverPath: tekCover?.storage_path ?? null,
      tekHatCoverMime: tekCover?.mime_type ?? null,
      panoIciCoverPath: panoCover?.storage_path ?? null,
      panoIciCoverMime: panoCover?.mime_type ?? null,
    };
  });
}

export async function countPanels(regionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("panel_label_panels")
    .select("id", { count: "exact", head: true })
    .eq("region_id", regionId)
    .eq("visible", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createPanel(
  regionId: string,
  name: string,
): Promise<PanelLabelPanel> {
  const userId = await resolveUserId();
  const panels = await listPanels(regionId);
  const sortOrder =
    panels.length === 0 ? 0 : Math.max(...panels.map((p) => p.sortOrder)) + 1;

  const { data, error } = await supabase
    .from("panel_label_panels")
    .insert({
      region_id: regionId,
      name: name.trim(),
      sort_order: sortOrder,
      user_id: userId,
    })
    .select(PANEL_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? "Pano eklenemedi");
  return mapPanel(data as DbPanel);
}

export async function getPanel(id: string): Promise<PanelLabelPanel | null> {
  const { data, error } = await supabase
    .from("panel_label_panels")
    .select(PANEL_SELECT)
    .eq("id", id)
    .eq("visible", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapPanel(data as DbPanel) : null;
}

export async function updatePanelName(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("panel_label_panels")
    .update({ name: name.trim() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function updatePanelNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("panel_label_panels")
    .update({ notes })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export type PanelLabelPanelDetails = {
  notes: string;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
};

export async function updatePanelDetails(
  id: string,
  details: PanelLabelPanelDetails,
): Promise<void> {
  const { error } = await supabase
    .from("panel_label_panels")
    .update({
      notes: details.notes,
      width_cm: details.widthCm,
      height_cm: details.heightCm,
      depth_cm: details.depthCm,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function listPanelImages(
  panelId: string,
  category: PanelLabelImageCategory,
): Promise<PanelLabelImage[]> {
  const { data, error } = await supabase
    .from("panel_label_images")
    .select(
      "id, panel_id, category, title, storage_path, mime_type, sort_order, created_at",
    )
    .eq("panel_id", panelId)
    .eq("category", category)
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbImage[]).map(mapImage);
}

export async function addPanelImage(
  panelId: string,
  category: PanelLabelImageCategory,
  file: File,
  title?: string,
): Promise<PanelLabelImage> {
  const userId = await resolveUserId();
  const existing = await listPanelImages(panelId, category);
  const sortOrder =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((i) => i.sortOrder)) + 1;

  const upload = await uploadToStorage({
    userId,
    folder: `panel-label-check/${panelId}/${category}`,
    file,
    contentType: panelAssetMimeType(file),
  });

  if ("error" in upload) throw new Error(upload.error);

  const mimeType = panelAssetMimeType(file);

  const { data, error } = await supabase
    .from("panel_label_images")
    .insert({
      panel_id: panelId,
      category,
      title: (title ?? "").trim(),
      storage_path: upload.path,
      mime_type: mimeType,
      sort_order: sortOrder,
      user_id: userId,
    })
    .select(
      "id, panel_id, category, title, storage_path, mime_type, sort_order, created_at",
    )
    .single();

  if (error || !data) {
    await deleteFromStorage(upload.path);
    throw new Error(error?.message ?? "Görsel kaydedilemedi");
  }

  return mapImage(data as DbImage);
}

export async function updatePanelImageTitle(
  id: string,
  title: string,
): Promise<void> {
  const { error } = await supabase
    .from("panel_label_images")
    .update({ title: title.trim() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deletePanelImage(id: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from("panel_label_images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (data?.storage_path) await deleteFromStorage(data.storage_path);

  const { error } = await supabase.from("panel_label_images").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function deleteAllPanelImages(panelId: string): Promise<void> {
  const { data, error } = await supabase
    .from("panel_label_images")
    .select("storage_path")
    .eq("panel_id", panelId);

  if (error) throw new Error(error.message);
  await Promise.all(
    (data ?? []).map((row) =>
      row.storage_path ? deleteFromStorage(row.storage_path) : Promise.resolve(),
    ),
  );
}

export async function deletePanel(id: string): Promise<void> {
  await deleteAllPanelImages(id);
  const { error } = await supabase
    .from("panel_label_panels")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
