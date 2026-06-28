import { supabase } from "./supabase";
import {
  deleteFromStorage,
  getPublicUrl,
  uploadToStorage,
} from "./storage";

export type ExpenseFolder = {
  id: string;
  title: string;
  createdAt: string;
};

export type ExpenseReceiptMeta = {
  id: string;
  folderId: string;
  title: string;
  amount: number;
  date: string;
  mimeType: string;
  storagePath: string;
  createdAt: string;
};

export type ExpenseReceipt = ExpenseReceiptMeta & {
  blob: Blob;
};

type DbFolder = {
  id: string;
  title: string;
  created_at: string;
};

type DbReceipt = {
  id: string;
  folder_id: string;
  title: string;
  amount: number;
  receipt_date: string;
  storage_path: string;
  mime_type: string;
  created_at: string;
};

const MIGRATION_FLAG = "koryon-expense-idb-migrated";

async function resolveUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? "shared";
}

function mapFolder(row: DbFolder): ExpenseFolder {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
  };
}

function mapReceipt(row: DbReceipt): ExpenseReceiptMeta {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    amount: Number(row.amount),
    date: row.receipt_date,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export function receiptImageUrl(
  receipt: Pick<ExpenseReceiptMeta, "storagePath">,
  transform?: { width?: number; height?: number; quality?: number },
): string | null {
  return getPublicUrl(receipt.storagePath, transform);
}

export async function listFolders(): Promise<ExpenseFolder[]> {
  const { data, error } = await supabase
    .from("expense_folders")
    .select("id, title, created_at")
    .eq("visible", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbFolder[]).map(mapFolder);
}

export async function getFolder(id: string): Promise<ExpenseFolder | null> {
  const { data, error } = await supabase
    .from("expense_folders")
    .select("id, title, created_at")
    .eq("id", id)
    .eq("visible", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapFolder(data as DbFolder) : null;
}

export async function createFolder(title: string): Promise<ExpenseFolder> {
  const userId = await resolveUserId();
  const { data, error } = await supabase
    .from("expense_folders")
    .insert({ title: title.trim(), user_id: userId })
    .select("id, title, created_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Klasör oluşturulamadı");
  return mapFolder(data as DbFolder);
}

export async function deleteFolder(id: string): Promise<void> {
  const receipts = await listReceipts(id);
  await Promise.all(receipts.map((r) => deleteFromStorage(r.storagePath)));

  const { error } = await supabase.from("expense_folders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listReceipts(folderId: string): Promise<ExpenseReceiptMeta[]> {
  const { data, error } = await supabase
    .from("expense_receipts")
    .select(
      "id, folder_id, title, amount, receipt_date, storage_path, mime_type, created_at",
    )
    .eq("folder_id", folderId)
    .eq("visible", true)
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbReceipt[]).map(mapReceipt);
}

export async function getReceipt(id: string): Promise<ExpenseReceipt | null> {
  const { data, error } = await supabase
    .from("expense_receipts")
    .select(
      "id, folder_id, title, amount, receipt_date, storage_path, mime_type, created_at",
    )
    .eq("id", id)
    .eq("visible", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const meta = mapReceipt(data as DbReceipt);
  const url = getPublicUrl(meta.storagePath);
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Fiş görseli indirilemedi");
  const blob = await res.blob();

  return { ...meta, blob };
}

export async function addReceipt(
  folderId: string,
  file: File,
  title: string,
  amount: number,
  date: string,
): Promise<ExpenseReceiptMeta> {
  const userId = await resolveUserId();
  const mimeType = file.type || "image/jpeg";

  const upload = await uploadToStorage({
    userId,
    folder: `expense-receipts/${folderId}`,
    file,
    contentType: mimeType,
  });

  if ("error" in upload) throw new Error(upload.error);

  const { data, error } = await supabase
    .from("expense_receipts")
    .insert({
      folder_id: folderId,
      title: title.trim(),
      amount,
      receipt_date: date,
      storage_path: upload.path,
      mime_type: mimeType,
      user_id: userId,
    })
    .select(
      "id, folder_id, title, amount, receipt_date, storage_path, mime_type, created_at",
    )
    .single();

  if (error || !data) {
    await deleteFromStorage(upload.path);
    throw new Error(error?.message ?? "Fiş kaydedilemedi");
  }

  return mapReceipt(data as DbReceipt);
}

export async function deleteReceipt(id: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from("expense_receipts")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);

  if (data?.storage_path) {
    await deleteFromStorage(data.storage_path);
  }

  const { error } = await supabase.from("expense_receipts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function formatAmountForFilename(amount: number): string {
  if (Number.isInteger(amount)) return `${amount}TL`;
  return `${amount.toFixed(2).replace(".", ",")}TL`;
}

function formatDateForFilename(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function receiptDownloadFilename(
  receipt: Pick<ExpenseReceiptMeta, "title" | "amount" | "date" | "mimeType">,
): string {
  const ext = guessExtension(receipt.mimeType);
  const safeTitle = sanitizeFilenamePart(receipt.title) || "Fis";
  return `${safeTitle}-${formatAmountForFilename(receipt.amount)}-${formatDateForFilename(receipt.date)}.${ext}`;
}

function guessExtension(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("pdf")) return "pdf";
  return "jpg";
}

export async function downloadAllReceiptsZip(
  folderTitle: string,
  receipts: ExpenseReceipt[],
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();

  for (const receipt of receipts) {
    let name = receiptDownloadFilename(receipt);
    if (used.has(name)) {
      let i = 2;
      while (used.has(`${i}-${name}`)) i += 1;
      name = `${i}-${name}`;
    }
    used.add(name);
    zip.file(name, receipt.blob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const safeFolder = sanitizeFilenamePart(folderTitle) || "Harcırah";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFolder}-fisler.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function sumAmounts(receipts: Pick<ExpenseReceiptMeta, "amount">[]): number {
  return receipts.reduce((s, r) => s + r.amount, 0);
}

// --- IndexedDB → Supabase tek seferlik taşıma ---

type LegacyFolder = { id: string; title: string; createdAt: string };
type LegacyReceipt = {
  id: string;
  folderId: string;
  title: string;
  amount: number;
  date: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
};

const LEGACY_DB = "koryon-expense-receipts";

function openLegacyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => resolve(req.result);
  });
}

async function readLegacyFolders(db: IDBDatabase): Promise<LegacyFolder[]> {
  if (!db.objectStoreNames.contains("folders")) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction("folders", "readonly");
    const req = tx.objectStore("folders").getAll();
    req.onsuccess = () => resolve(req.result as LegacyFolder[]);
    req.onerror = () => reject(req.error);
  });
}

async function readLegacyReceipts(db: IDBDatabase): Promise<LegacyReceipt[]> {
  if (!db.objectStoreNames.contains("receipts")) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction("receipts", "readonly");
    const req = tx.objectStore("receipts").getAll();
    req.onsuccess = () => resolve(req.result as LegacyReceipt[]);
    req.onerror = () => reject(req.error);
  });
}

async function clearLegacyDb(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["folders", "receipts"], "readwrite");
    if (db.objectStoreNames.contains("folders")) tx.objectStore("folders").clear();
    if (db.objectStoreNames.contains("receipts")) tx.objectStore("receipts").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function migrateLocalExpenseDataIfNeeded(): Promise<boolean> {
  if (localStorage.getItem(MIGRATION_FLAG) === "1") return false;

  let db: IDBDatabase;
  try {
    db = await openLegacyDb();
  } catch {
    localStorage.setItem(MIGRATION_FLAG, "1");
    return false;
  }

  const legacyFolders = await readLegacyFolders(db);
  const legacyReceipts = await readLegacyReceipts(db);

  if (legacyFolders.length === 0 && legacyReceipts.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, "1");
    db.close();
    return false;
  }

  const folderIdMap = new Map<string, string>();

  for (const folder of legacyFolders.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    const created = await createFolder(folder.title);
    folderIdMap.set(folder.id, created.id);
  }

  for (const receipt of legacyReceipts) {
    const targetFolderId = folderIdMap.get(receipt.folderId);
    if (!targetFolderId) continue;

    const file = new File([receipt.blob], "receipt.jpg", {
      type: receipt.mimeType || "image/jpeg",
    });
    await addReceipt(
      targetFolderId,
      file,
      receipt.title,
      receipt.amount,
      receipt.date,
    );
  }

  await clearLegacyDb(db);
  db.close();
  localStorage.setItem(MIGRATION_FLAG, "1");
  return true;
}
