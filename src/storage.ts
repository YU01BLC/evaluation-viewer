import { DiagnosisShareData } from "./shareSchema";

const DB_NAME = "evaluation-viewer-db";
const STORE_NAME = "diagnosis-share-records";
const DB_VERSION = 1;

export type StoredDiagnosisRecord = {
  id: string;
  savedAt: string;
  data: DiagnosisShareData;
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });

const hashString = (source: string) => {
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return `rec_${(hash >>> 0).toString(16)}`;
};

const buildRecordId = (data: DiagnosisShareData) => {
  const stablePayload = JSON.stringify({
    raceInfo: data.raceInfo,
    results: data.results
  });
  return hashString(stablePayload);
};

export const listStoredDiagnosisRecords = async (): Promise<StoredDiagnosisRecord[]> => {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const rows = await requestToPromise(store.getAll() as IDBRequest<StoredDiagnosisRecord[]>);
    await transactionDone(transaction);
    return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } finally {
    db.close();
  }
};

export const upsertDiagnosisRecord = async (
  data: DiagnosisShareData,
): Promise<StoredDiagnosisRecord> => {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const id = buildRecordId(data);
    const row: StoredDiagnosisRecord = {
      id,
      savedAt: new Date().toISOString(),
      data
    };
    store.put(row);
    await transactionDone(transaction);
    return row;
  } finally {
    db.close();
  }
};

export const deleteStoredDiagnosisRecord = async (id: string): Promise<void> => {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
};
