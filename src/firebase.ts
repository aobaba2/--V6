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
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
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
      // Check if there is a pre-created user document with the same email
      let preAssignedRole: UserRole = user.email === 'aoba2026@admin.com' ? 'admin' : 'free';
      let foundPreCreatedId: string | null = null;
      let preCreatedData: Partial<UserProfile> = {};
      
      if (user.email) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', user.email));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const preDoc = querySnap.docs[0];
            const preData = preDoc.data() as UserProfile;
            preAssignedRole = preData.role;
            foundPreCreatedId = preDoc.id;
            preCreatedData = preData;
          }
        } catch (err) {
          console.error("Error searching pre-created profile:", err);
        }
      }

      const emailName = user.email ? user.email.split('@')[0] : '交易员';
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || preCreatedData.displayName || emailName,
        photoURL: user.photoURL || preCreatedData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid.slice(0, 5)}`,
        role: preAssignedRole,
        createdAt: preCreatedData.createdAt || serverTimestamp(),
        lastLogin: serverTimestamp(),
        aiAnalysisCount: preCreatedData.aiAnalysisCount || 0,
        mockTradingEnabled: preCreatedData.mockTradingEnabled !== undefined ? preCreatedData.mockTradingEnabled : true,
        favorites: preCreatedData.favorites || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
        followedInfluencers: preCreatedData.followedInfluencers || ['老王', 'Sarah', '陈总'],
        hiddenInfluencers: preCreatedData.hiddenInfluencers || []
      };
      
      await setDoc(userRef, newProfile);

      // Clean up placeholder pre-created document if its ID was different from the active uid
      if (foundPreCreatedId && foundPreCreatedId !== user.uid) {
        try {
          await deleteDoc(doc(db, 'users', foundPreCreatedId));
        } catch (delErr) {
          console.error("Error deleting placeholder document:", delErr);
        }
      }

      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    throw error;
  }
};
