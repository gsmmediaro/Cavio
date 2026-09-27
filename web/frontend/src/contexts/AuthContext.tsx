import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { syncBackendAccount } from "../api/client";

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  speciality: string;
  role: string;
  orgName: string;
  orgSize: string;
  onboarded: boolean;
  createdAt: any;
  trialStartedAt: any;
}

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  showAuthGate: boolean;
  setShowAuthGate: React.Dispatch<React.SetStateAction<boolean>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthGate, setShowAuthGate] = useState(false);

  const fetchProfile = async (u: User) => {
    try {
      await syncBackendAccount();
    } catch (err) {
      console.warn("Backend account sync failed", err);
    }
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) {
      setUserProfile(snap.data() as UserProfile);
    } else {
      // New user — create skeleton profile
      const profile: UserProfile = {
        firstName: u.displayName?.split(" ")[0] || "",
        lastName: u.displayName?.split(" ").slice(1).join(" ") || "",
        email: u.email || "",
        speciality: "",
        role: "",
        orgName: "",
        orgSize: "",
        onboarded: false,
        createdAt: serverTimestamp(),
        trialStartedAt: null,
      };
      await setDoc(doc(db, "users", u.uid), profile);
      setUserProfile(profile);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile(u);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile: UserProfile = {
      firstName,
      lastName,
      email,
      speciality: "",
      role: "",
      orgName: "",
      orgSize: "",
      onboarded: false,
      createdAt: serverTimestamp(),
      trialStartedAt: null,
    };
    await setDoc(doc(db, "users", cred.user.uid), profile);
    setUserProfile(profile);
  };

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, register, loginWithGoogle, logout, refreshProfile, showAuthGate, setShowAuthGate }}>
      {children}
    </AuthContext.Provider>
  );
}
