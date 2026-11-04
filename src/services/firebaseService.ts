import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ImportProcess } from '../types/mfx';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

// Sanitize objects before sending to Firestore (strips `undefined` fields which Firestore rejects)
function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Test initial connection
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'mfx_fup_meta', 'latest'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline: checking local connectivity');
      return false;
    }
    // Even if doc doesn't exist yet, server responded
    return true;
  }
}

// LocalStorage backup keys
const LOCAL_STORAGE_KEY_PROCESSOS = 'mfx_fup_cached_processos';
const LOCAL_STORAGE_KEY_META = 'mfx_fup_cached_meta';

export function getCachedProcessos(): ImportProcess[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PROCESSOS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function getCachedMeta(): { sourceFileName?: string; lastUpdatedTime?: string } | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_META);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCachedProcessos(
  processos: ImportProcess[],
  meta?: { sourceFileName?: string; lastUpdatedTime?: string }
) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PROCESSOS, JSON.stringify(processos));
    if (meta) {
      localStorage.setItem(LOCAL_STORAGE_KEY_META, JSON.stringify(meta));
    }
  } catch (e) {
    console.warn('LocalStorage cache write error:', e);
  }
}

export interface SyncMetaUpdate {
  sourceFileName?: string;
  lastUpdatedTime?: string;
  updatedBy?: string;
  totalProcesses?: number;
  isOnline: boolean;
}

/**
 * Real-time subscription to online Firestore dataset.
 * Listens to mfx_fup_meta/latest and loads all active chunks from mfx_fup_chunks.
 * If the cloud database has never been initialized yet, automatically seeds it
 * with the initial dataset so all connected users and TV screens share the same data.
 */
export function subscribeToOnlineProcessos(
  onUpdate: (processos: ImportProcess[], meta?: SyncMetaUpdate) => void,
  onStatusChange?: (isOnline: boolean) => void,
  initialSeedProcessos?: ImportProcess[],
  initialSourceFileName?: string,
  initialLastUpdated?: string
): () => void {
  let isListening = true;
  let hasAttemptedSeed = false;

  const unsubscribeMeta = onSnapshot(
    doc(db, 'mfx_fup_meta', 'latest'),
    async (metaSnap) => {
      if (!isListening) return;

      if (metaSnap.exists()) {
        const metaData = metaSnap.data();
        const expectedChunks = typeof metaData.totalChunks === 'number' ? metaData.totalChunks : 999;
        onStatusChange?.(true);

        // Fetch chunked documents
        try {
          const chunksSnap = await getDocs(collection(db, 'mfx_fup_chunks'));
          if (!chunksSnap.empty) {
            const allProcesses: ImportProcess[] = [];
            const sortedDocs = chunksSnap.docs
              .filter((d) => {
                const idx = d.data().chunkIndex ?? 0;
                return idx < expectedChunks;
              })
              .sort((a, b) => {
                const idxA = a.data().chunkIndex ?? 0;
                const idxB = b.data().chunkIndex ?? 0;
                return idxA - idxB;
              });

            sortedDocs.forEach((d) => {
              const chunkData = d.data();
              if (Array.isArray(chunkData.items)) {
                allProcesses.push(...chunkData.items);
              }
            });

            if (allProcesses.length > 0) {
              saveCachedProcessos(allProcesses, {
                sourceFileName: metaData.sourceFileName,
                lastUpdatedTime: metaData.lastUpdatedTime,
              });

              onUpdate(allProcesses, {
                sourceFileName: metaData.sourceFileName,
                lastUpdatedTime: metaData.lastUpdatedTime,
                updatedBy: metaData.updatedBy || 'Equipe MFX Comex',
                totalProcesses: allProcesses.length,
                isOnline: true,
              });
              return;
            }
          }
        } catch (err) {
          console.warn('Could not read chunks, trying fallback collection:', err);
        }

        // Fallback: Check individual 'processos' collection if chunks aren't present yet
        try {
          const procSnap = await getDocs(collection(db, 'processos'));
          if (!procSnap.empty) {
            const procs: ImportProcess[] = [];
            procSnap.forEach((d) => {
              const data = d.data() as ImportProcess;
              if (data && data.id) procs.push(data);
            });
            if (procs.length > 0) {
              onUpdate(procs, {
                sourceFileName: metaData.sourceFileName,
                lastUpdatedTime: metaData.lastUpdatedTime,
                updatedBy: metaData.updatedBy || 'Equipe MFX Comex',
                totalProcesses: procs.length,
                isOnline: true,
              });
              return;
            }
          }
        } catch (err) {
          console.warn('Could not read individual processos:', err);
        }
      } else if (
        !hasAttemptedSeed &&
        initialSeedProcessos &&
        initialSeedProcessos.length > 0
      ) {
        // Cloud database is empty on first launch: automatically seed it so everyone online sees the same base
        hasAttemptedSeed = true;
        onStatusChange?.(true);
        const cached = getCachedProcessos();
        const cachedMeta = getCachedMeta();
        const toPublish = cached && cached.length > 0 ? cached : initialSeedProcessos;
        const fileToUse = cachedMeta?.sourceFileName || initialSourceFileName || 'FUP IMPORTAÇÃO BI (Base Online MFX)';
        const timeToUse = cachedMeta?.lastUpdatedTime || initialLastUpdated || new Date().toLocaleString('pt-BR');

        await publishToCloudFirestore(toPublish, fileToUse, timeToUse, 'Inicialização Automática MFX');
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'mfx_fup_meta/latest');
      onStatusChange?.(false);

      // Load from localStorage cache if offline
      const cached = getCachedProcessos();
      const cachedMeta = getCachedMeta();
      if (cached && cached.length > 0) {
        onUpdate(cached, {
          sourceFileName: cachedMeta?.sourceFileName,
          lastUpdatedTime: cachedMeta?.lastUpdatedTime,
          isOnline: false,
        });
      }
    }
  );

  return () => {
    isListening = false;
    unsubscribeMeta();
  };
}

/**
 * Chunked Upload Persistence to Firestore:
 * Sanitizes undefined properties, splits processos into chunks of 40 processes per document
 * (staying well under 1MB), and writes to mfx_fup_chunks + mfx_fup_meta/latest in an atomic writeBatch.
 * Also persists local backup in localStorage.
 */
export async function publishToCloudFirestore(
  processos: ImportProcess[],
  sourceFileName: string,
  lastUpdatedTime: string,
  updatedBy = 'Equipe MFX Comex'
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const cleanProcessos = sanitizeForFirestore(processos);

    // 1. Cache immediately to localStorage for instant local resiliency
    saveCachedProcessos(cleanProcessos, { sourceFileName, lastUpdatedTime });

    // 2. Prepare chunking (40 items per chunk document to stay well within 1MB doc limits)
    const CHUNK_SIZE = 40;
    const totalChunks = Math.max(1, Math.ceil(cleanProcessos.length / CHUNK_SIZE));
    const batch = writeBatch(db);

    for (let c = 0; c < totalChunks; c++) {
      const chunkItems = cleanProcessos.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      const chunkDocRef = doc(db, 'mfx_fup_chunks', `chunk_${c}`);
      batch.set(chunkDocRef, {
        chunkIndex: c,
        itemsCount: chunkItems.length,
        items: chunkItems,
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Write metadata document (triggers onSnapshot across all connected users & TVs)
    const nowIso = new Date().toISOString();
    const metaRef = doc(db, 'mfx_fup_meta', 'latest');
    batch.set(metaRef, {
      sourceFileName: sourceFileName || 'FUP IMPORTAÇÃO BI.xlsx',
      lastUpdatedTime: lastUpdatedTime || new Date().toLocaleString('pt-BR'),
      totalProcesses: cleanProcessos.length,
      totalChunks,
      updatedBy,
      updatedAt: nowIso,
    });

    // Also update legacy meta doc for backward compatibility
    const legacyMetaRef = doc(db, 'meta', 'dataset');
    batch.set(legacyMetaRef, {
      sourceFileName: sourceFileName || 'FUP IMPORTAÇÃO BI.xlsx',
      lastUpdatedTime: lastUpdatedTime || new Date().toLocaleString('pt-BR'),
      totalCount: cleanProcessos.length,
      updatedAt: nowIso,
    });

    await batch.commit();
    return { success: true, count: cleanProcessos.length };
  } catch (error) {
    const info = handleFirestoreError(error, OperationType.WRITE, 'mfx_fup_chunks');
    return { success: false, count: 0, error: info.error };
  }
}
