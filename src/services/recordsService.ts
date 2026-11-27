import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { clampString } from '../utils/writingLogic';
import type { SupportLevel, TopicId, WritingRecord } from '../types';

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const LOCAL_STORAGE_RECORDS_KEY = 'pick_and_write_local_records_v1';
const LOCAL_STORAGE_LEVEL_KEY = 'pick_and_write_local_level_v1';

export function loadLocalLevel(): SupportLevel {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_LEVEL_KEY);
    if (raw === '2') return 2;
    if (raw === '3') return 3;
    return 1;
  } catch {
    return 1;
  }
}

export function saveLocalLevel(level: SupportLevel): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_LEVEL_KEY, String(level));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function loadLocalRecords(): WritingRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WritingRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalRecord(record: WritingRecord): WritingRecord[] {
  const current = loadLocalRecords();
  const next = [record, ...current].slice(0, 50);
  try {
    window.localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export async function ensureStudentProfile(
  uid: string,
  displayName: string
): Promise<SupportLevel> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const lvl = data.currentLevel;
      if (lvl === 1 || lvl === 2 || lvl === 3) {
        return lvl;
      }
      return 1;
    }

    await setDoc(ref, {
      uid: clampString(uid, 128),
      displayName: clampString(displayName || 'Student', 100),
      currentLevel: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return 1;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateStudentLevelInCloud(
  uid: string,
  displayName: string,
  nextLevel: SupportLevel
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
      displayName: clampString(displayName || 'Student', 100),
      currentLevel: nextLevel,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function mapSnapshotDoc(id: string, data: Record<string, unknown>): WritingRecord {
  const rawDate = data.createdAt;
  let createdAtIso = new Date().toISOString();
  if (rawDate instanceof Timestamp) {
    createdAtIso = rawDate.toDate().toISOString();
  } else if (typeof rawDate === 'string') {
    createdAtIso = rawDate;
  }
  const lvl = data.level === 2 || data.level === 3 ? data.level : 1;
  const nextLvl = data.nextLevel === 2 || data.nextLevel === 3 ? data.nextLevel : 1;
  const topic: TopicId =
    data.topic === 'place' || data.topic === 'hobby' ? data.topic : 'food';

  return {
    id,
    uid: String(data.uid ?? ''),
    studentName: String(data.studentName ?? 'Student'),
    topic,
    topicTitle: String(data.topicTitle ?? 'My Favorite Food'),
    level: lvl,
    nextLevel: nextLvl,
    hintsUsed: Number(data.hintsUsed ?? 1),
    planQ1: String(data.planQ1 ?? ''),
    planQ2: String(data.planQ2 ?? ''),
    planQ3: String(data.planQ3 ?? ''),
    planQ4: String(data.planQ4 ?? ''),
    firstDraft: String(data.firstDraft ?? ''),
    finalParagraph: String(data.finalParagraph ?? ''),
    reflection: String(data.reflection ?? ''),
    aiPraise: String(data.aiPraise ?? ''),
    aiFixPoint: String(data.aiFixPoint ?? ''),
    aiQuestion: String(data.aiQuestion ?? ''),
    fixedOnFirstTry: Boolean(data.fixedOnFirstTry),
    createdAtIso,
    source: 'cloud',
  };
}

export async function saveWritingRecordToCloud(params: {
  uid: string;
  studentName: string;
  topic: TopicId;
  topicTitle: string;
  level: SupportLevel;
  nextLevel: SupportLevel;
  hintsUsed: number;
  planQ1: string;
  planQ2: string;
  planQ3: string;
  planQ4: string;
  firstDraft: string;
  finalParagraph: string;
  reflection: string;
  aiPraise: string;
  aiFixPoint: string;
  aiQuestion: string;
  fixedOnFirstTry: boolean;
}): Promise<WritingRecord> {
  const safeId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `writingRecords/${safeId}`;
  const hintsClamped = Math.max(0, Math.min(3, Math.round(params.hintsUsed)));

  const payload = {
    uid: clampString(params.uid, 128),
    studentName: clampString(params.studentName || 'Student', 100),
    topic: params.topic,
    topicTitle: clampString(params.topicTitle, 60),
    level: params.level,
    nextLevel: params.nextLevel,
    hintsUsed: hintsClamped,
    planQ1: clampString(params.planQ1, 300),
    planQ2: clampString(params.planQ2, 300),
    planQ3: clampString(params.planQ3, 300),
    planQ4: clampString(params.planQ4, 300),
    firstDraft: clampString(params.firstDraft, 2000),
    finalParagraph: clampString(params.finalParagraph, 2000),
    reflection: clampString(params.reflection, 500),
    aiPraise: clampString(params.aiPraise, 400),
    aiFixPoint: clampString(params.aiFixPoint, 400),
    aiQuestion: clampString(params.aiQuestion, 400),
    fixedOnFirstTry: Boolean(params.fixedOnFirstTry),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'writingRecords', safeId), payload);
    return {
      ...payload,
      id: safeId,
      createdAtIso: new Date().toISOString(),
      source: 'cloud',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToStudentRecords(
  uid: string,
  onData: (records: WritingRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'writingRecords';
  const q = query(
    collection(db, 'writingRecords'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        mapSnapshotDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function fetchAllRecordsForTeacher(): Promise<WritingRecord[]> {
  const path = 'writingRecords';
  try {
    const q = query(collection(db, 'writingRecords'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) =>
      mapSnapshotDoc(d.id, d.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
