import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export type UserRole = 'free' | 'pro' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  createdAt: any;
  lastLogin: any;
  aiAnalysisCount: number;
  mockTradingEnabled: boolean;
  favorites: string[];
  followedInfluencers: string[];
  hiddenInfluencers: string[];
}

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signInEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const signUpEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const logOut = () => signOut(auth);

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getOrCreateProfile = async (user: User): Promise<UserProfile> => {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      // Ensure super admin always has admin role
      if (user.email === 'aoba2026@admin.com' && data.role !== 'admin') {
        await setDoc(userRef, { role: 'admin', lastLogin: serverTimestamp() }, { merge: true });
        return { ...data, role: 'admin' };
      }
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
      return data;
    } else {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '管理员',
        photoURL: user.photoURL || '',
        role: user.email === 'aoba2026@admin.com' ? 'admin' : 'free',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        aiAnalysisCount: 0,
        mockTradingEnabled: true,
        favorites: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
        followedInfluencers: ['老王', 'Sarah', '陈总'],
        hiddenInfluencers: []
      };
      await setDoc(userRef, newProfile);
      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    throw error;
  }
};
