import { supabase } from "./supabase";
import { deleteFromStorage, uploadToStorage } from "./storage";

export type PanelLabelWorkflowStatus = "neutral" | "in_progress" | "completed";

export type RegionWorkflowHighlight = "in_progress" | "completed" | null;

export const PANEL_WORKFLOW_LABELS: Record<PanelLabelWorkflowStatus, string> = {
  neutral: "Nötr",
  in_progress: "İşleme Alındı",
  completed: "Tamamlandı",
};

export function normalizePanelWorkflowStatus(
  status: PanelLabelWorkflowStatus | null,
): PanelLabelWorkflowStatus {
  return status ?? "neutral";
}

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
  locationDirection: string;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  workflowStatus: PanelLabelWorkflowStatus | null;
  createdAt: string;
};

export type PanelLabelPanelSummary = PanelLabelPanel & {
  tekHatCount: number;
  panoIciCount: number;
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
  location_direction: string | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  workflow_status: PanelLabelWorkflowStatus | null;
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
    locationDirection: row.location_direction ?? "",
    widthCm: row.width_cm,
    heightCm: row.height_cm,
    depthCm: row.depth_cm,
    workflowStatus: row.workflow_status ?? null,
    createdAt: row.created_at,
  };
}

export function regionWorkflowRowClass(
  highlight: RegionWorkflowHighlight,
): string {
  if (highlight === "in_progress") return "bg-amber-50 border-amber-200";
  if (highlight === "completed") return "bg-emerald-50 border-emerald-200";
  return "bg-white border-zinc-200";
}

export function panelWorkflowRowClass(
  status: PanelLabelWorkflowStatus | null,
): string {
  const normalized = normalizePanelWorkflowStatus(status);
  if (normalized === "in_progress") return "border-amber-200 bg-amber-50/40";
  if (normalized === "completed") return "border-emerald-200 bg-emerald-50/40";
  return "border-zinc-200 bg-white";
}

export async function mapRegionWorkflowHighlights(
  regionIds: string[],
): Promise<Map<string, RegionWorkflowHighlight>> {
  const result = new Map<string, RegionWorkflowHighlight>();
  for (const id of regionIds) result.set(id, null);
  if (regionIds.length === 0) return result;

  const { data, error } = await supabase
    .from("panel_label_panels")
    .select("region_id, workflow_status")
    .in("region_id", regionIds)
    .eq("visible", true);

  if (error) throw new Error(error.message);

  type Row = {
    region_id: string;
    workflow_status: PanelLabelWorkflowStatus | null;
  };

  const stats = new Map<
    string,
    { total: number; inProgress: number; completed: number }
  >();

  for (const row of (data ?? []) as Row[]) {
    const bucket = stats.get(row.region_id) ?? {
      total: 0,
      inProgress: 0,
      completed: 0,
    };
    bucket.total += 1;
    if (row.workflow_status === "in_progress") bucket.inProgress += 1;
    if (row.workflow_status === "completed") bucket.completed += 1;
    stats.set(row.region_id, bucket);
  }

  for (const [regionId, bucket] of stats) {
    if (bucket.total === 0) continue;
    if (bucket.inProgress > 0) {
      result.set(regionId, "in_progress");
    } else if (bucket.completed === bucket.total) {
      result.set(regionId, "completed");
    }
  }

  return result;
}

export async function updatePanelWorkflowStatus(
  id: string,
  status: PanelLabelWorkflowStatus,
): Promise<void> {
  const { error } = await supabase
    .from("panel_label_panels")
    .update({ workflow_status: status })
    .eq("id", id);

  if (error) throw new Error(error.message);
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

export function normalizePanelLabelSearch(text: string): string {
  return text.toLocaleLowerCase("tr").normalize("NFKC");
}

export function matchesPanelLabelQuery(
  fields: string[],
  query: string,
): boolean {
  const q = normalizePanelLabelSearch(query.trim());
  if (!q) return true;
  return fields.some((field) =>
    normalizePanelLabelSearch(field).includes(q),
  );
}

export function filterPanelByQuery(
  panel: Pick<PanelLabelPanel, "name" | "notes" | "locationDirection">,
  query: string,
): boolean {
  return matchesPanelLabelQuery(
    [panel.name, panel.notes, panel.locationDirection],
    query,
  );
}

export type PanelLabelSearchHit = {
  regionId: string;
  regionName: string;
  panelId: string;
  panelName: string;
};

export async function searchPanelLabels(
  query: string,
  regionId?: string,
): Promise<PanelLabelSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

  let request = supabase
    .from("panel_label_panels")
    .select(
      "id, name, region_id, panel_label_regions!inner(name, visible)",
    )
    .eq("visible", true)
    .eq("panel_label_regions.visible", true)
    .or(
      `name.ilike.${pattern},notes.ilike.${pattern},location_direction.ilike.${pattern}`,
    )
    .order("name", { ascending: true })
    .limit(40);

  if (regionId) {
    request = request.eq("region_id", regionId);
  }

  const { data, error } = await request;
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    name: string;
    region_id: string;
    panel_label_regions: { name: string; visible: boolean } | null;
  };

  return ((data ?? []) as Row[]).map((row) => ({
    regionId: row.region_id,
    regionName: row.panel_label_regions?.name ?? "",
    panelId: row.id,
    panelName: row.name,
  }));
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
  const now = new Date().toISOString();

  const { error: panelsErr } = await supabase
    .from("panel_label_panels")
    .update({ visible: false, deleted_at: now })
    .eq("region_id", id)
    .eq("visible", true);

  if (panelsErr) throw new Error(panelsErr.message);

  const { error } = await supabase
    .from("panel_label_regions")
    .update({ visible: false, deleted_at: now })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function restoreRegion(id: string): Promise<void> {
  const { error: panelsErr } = await supabase
    .from("panel_label_panels")
    .update({ visible: true, deleted_at: null })
    .eq("region_id", id);

  if (panelsErr) throw new Error(panelsErr.message);

  const { error } = await supabase
    .from("panel_label_regions")
    .update({ visible: true, deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export type PanelLabelTrashRegion = PanelLabelRegion & {
  deletedAt: string;
  panelCount: number;
};

export async function listDeletedRegions(): Promise<PanelLabelTrashRegion[]> {
  const { data, error } = await supabase
    .from("panel_label_regions")
    .select("id, name, sort_order, created_at, deleted_at")
    .eq("visible", false)
    .order("deleted_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as (DbRegion & { deleted_at: string })[];

  return Promise.all(
    rows.map(async (row) => {
      const { count } = await supabase
        .from("panel_label_panels")
        .select("id", { count: "exact", head: true })
        .eq("region_id", row.id);

      return {
        ...mapRegion(row),
        deletedAt: row.deleted_at ?? row.created_at,
        panelCount: count ?? 0,
      };
    }),
  );
}

const PANEL_SELECT =
  "id, region_id, name, sort_order, notes, location_direction, width_cm, height_cm, depth_cm, workflow_status, created_at";

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
    .select("panel_id, category")
    .in("panel_id", panelIds)
    .eq("visible", true);

  if (error) throw new Error(error.message);

  type Row = {
    panel_id: string;
    category: PanelLabelImageCategory;
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
    return {
      ...panel,
      tekHatCount: assets.tekHat.length,
      panoIciCount: assets.panoIci.length,
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
  locationDirection: string;
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
      location_direction: details.locationDirection,
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

export async function deletePanelImage(_id: string): Promise<void> {
  throw new Error("Pano etiket görselleri silinemez.");
}

export async function deletePanel(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("panel_label_panels")
    .update({ visible: false, deleted_at: now })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function restorePanel(id: string): Promise<void> {
  const { data: panel, error: fetchErr } = await supabase
    .from("panel_label_panels")
    .select("region_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!panel) throw new Error("Pano bulunamadı.");

  const { data: region, error: regionErr } = await supabase
    .from("panel_label_regions")
    .select("visible")
    .eq("id", panel.region_id)
    .maybeSingle();

  if (regionErr) throw new Error(regionErr.message);
  if (!region?.visible) {
    throw new Error("Önce bağlı olduğu bölgeyi geri yükleyin.");
  }

  const { error } = await supabase
    .from("panel_label_panels")
    .update({ visible: true, deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export type PanelLabelTrashPanel = PanelLabelPanel & {
  deletedAt: string;
  regionName: string;
  tekHatCount: number;
  panoIciCount: number;
};

export async function listDeletedPanels(): Promise<PanelLabelTrashPanel[]> {
  const { data, error } = await supabase
    .from("panel_label_panels")
    .select(
      `${PANEL_SELECT}, deleted_at, panel_label_regions!inner(name)`,
    )
    .eq("visible", false)
    .order("deleted_at", { ascending: false });

  if (error) throw new Error(error.message);

  type Row = DbPanel & {
    deleted_at: string | null;
    panel_label_regions: { name: string };
  };

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const panelIds = rows.map((r) => r.id);
  const { data: images, error: imgErr } = await supabase
    .from("panel_label_images")
    .select("panel_id, category")
    .in("panel_id", panelIds)
    .eq("visible", true);

  if (imgErr) throw new Error(imgErr.message);

  const counts = new Map<string, { tekHat: number; panoIci: number }>();
  for (const id of panelIds) counts.set(id, { tekHat: 0, panoIci: 0 });
  for (const img of images ?? []) {
    const bucket = counts.get(img.panel_id);
    if (!bucket) continue;
    if (img.category === "tek_hat") bucket.tekHat += 1;
    else bucket.panoIci += 1;
  }

  return rows.map((row) => {
    const c = counts.get(row.id) ?? { tekHat: 0, panoIci: 0 };
    return {
      ...mapPanel(row),
      deletedAt: row.deleted_at ?? row.created_at,
      regionName: row.panel_label_regions.name,
      tekHatCount: c.tekHat,
      panoIciCount: c.panoIci,
    };
  });
}
