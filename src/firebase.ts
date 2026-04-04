import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
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
export const logOut = () => signOut(auth);

export const getOrCreateProfile = async (user: User): Promise<UserProfile> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data() as UserProfile;
    await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
    return data;
  } else {
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '匿名用户',
      photoURL: user.photoURL || '',
      role: 'free', // Default to free
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      aiAnalysisCount: 0,
      mockTradingEnabled: true,
      favorites: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'], // Default favorites
      followedInfluencers: ['老王', 'Sarah', '陈总'], // Default influencers
      hiddenInfluencers: []
    };
    await setDoc(userRef, newProfile);
    return newProfile;
  }
};
