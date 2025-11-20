
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// --- CONFIGURATION ---
// Real Firebase Config for Analog.ai
const firebaseConfig = {
  apiKey: "AIzaSyCYHNiHWYI2p1r9L-IDSg27-bY0IIWZMfM",
  authDomain: "analog-ai-1.firebaseapp.com",
  projectId: "analog-ai-1",
  storageBucket: "analog-ai-1.firebasestorage.app",
  messagingSenderId: "387345979836",
  appId: "1:387345979836:web:11400c7c345eba4db733b9",
  measurementId: "G-SX3LN6QQ25"
};

let auth: any = null;
let db: any = null;
let googleProvider: any = null;
let analytics: any = null;

// Track if we forced a fallback due to domain errors
let isFallbackMode = false;

// Initialize Firebase if config is present
const isFirebaseConfigured = !!firebaseConfig.apiKey;

if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    try {
        analytics = getAnalytics(app);
    } catch(e) {
        console.warn("Analytics failed to load", e);
    }
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    isFallbackMode = true;
  }
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// --- AUTH SERVICE ---

export const authService = {
  
  // 1. LOGIN WITH GOOGLE
  loginGoogle: async (): Promise<UserProfile> => {
    if (isFirebaseConfigured && auth && !isFallbackMode) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        return { uid: result.user.uid, email: result.user.email, displayName: result.user.displayName };
      } catch (error: any) {
        console.warn("Firebase Google Auth failed:", error.code);
        
        // SMART FALLBACK:
        // If the domain is not authorized (common in preview environments) or operation not allowed,
        // we fallback to simulation so the user can still test the app flow.
        if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed' || error.code === 'auth/popup-closed-by-user') {
           console.info("Falling back to Simulation Mode due to environment restriction.");
           isFallbackMode = true; // Switch session to fallback
           
           await new Promise(resolve => setTimeout(resolve, 1000)); // Fake network delay
           const mockUser = { uid: "fallback-google-uid", email: "demo@analog.ai", displayName: "Demo User (Fallback)" };
           localStorage.setItem('analog_user_session', JSON.stringify(mockUser));
           return mockUser;
        }
        throw error;
      }
    } else {
      // SIMULATION FALLBACK
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockUser = { uid: "mock-google-uid-123", email: "user@gmail.com", displayName: "Demo User" };
      localStorage.setItem('analog_user_session', JSON.stringify(mockUser));
      return mockUser;
    }
  },

  // 2. REGISTER (Email/Pass)
  register: async (email: string, pass: string): Promise<UserProfile> => {
    if (isFirebaseConfigured && auth && !isFallbackMode) {
      try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        return { uid: result.user.uid, email: result.user.email, displayName: email.split('@')[0] };
      } catch (error: any) {
          console.warn("Registration failed:", error.code);
          // Fallback if firebase fails for generic reasons in preview
          isFallbackMode = true;
          return authService.register(email, pass); // Recursive call will hit else block
      }
    } else {
       // SIMULATION
       await new Promise(resolve => setTimeout(resolve, 1500));
       const mockUser = { uid: "mock-uid-" + Date.now(), email: email, displayName: email.split('@')[0] };
       localStorage.setItem('analog_user_session', JSON.stringify(mockUser));
       
       const users = JSON.parse(localStorage.getItem('analog_sim_users') || '{}');
       users[email] = { pass: btoa(pass), uid: mockUser.uid }; 
       localStorage.setItem('analog_sim_users', JSON.stringify(users));
       return mockUser;
    }
  },

  // 3. LOGIN (Email/Pass)
  login: async (email: string, pass: string): Promise<UserProfile> => {
    if (isFirebaseConfigured && auth && !isFallbackMode) {
      try {
        const result = await signInWithEmailAndPassword(auth, email, pass);
        return { uid: result.user.uid, email: result.user.email, displayName: result.user.displayName || email.split('@')[0] };
      } catch (error: any) {
          if (error.code === 'auth/network-request-failed') {
             isFallbackMode = true;
             return authService.login(email, pass);
          }
          throw error;
      }
    } else {
      // SIMULATION
      await new Promise(resolve => setTimeout(resolve, 1000));
      const users = JSON.parse(localStorage.getItem('analog_sim_users') || '{}');
      const user = users[email];
      
      if (user && user.pass === btoa(pass)) {
          const mockUser = { uid: user.uid, email: email, displayName: email.split('@')[0] };
          localStorage.setItem('analog_user_session', JSON.stringify(mockUser));
          return mockUser;
      }
      throw new Error("Invalid email or password (Simulation).");
    }
  },

  // 4. LOGOUT
  logout: async () => {
    if (isFirebaseConfigured && auth && !isFallbackMode) {
      await signOut(auth);
    }
    isFallbackMode = false; // Reset fallback on logout
    localStorage.removeItem('analog_user_session');
  },

  // 5. GET CURRENT USER
  getCurrentUser: (): UserProfile | null => {
    // If we are in fallback mode, rely on local storage
    if (isFirebaseConfigured && auth && !isFallbackMode) {
       if (auth.currentUser) return { uid: auth.currentUser.uid, email: auth.currentUser.email, displayName: auth.currentUser.displayName };
    }
    const stored = localStorage.getItem('analog_user_session');
    return stored ? JSON.parse(stored) : null;
  },

  // 6. DATA SYNC (Presets)
  // Automatically directs data to Firestore if online, or LocalStorage if in fallback mode
  saveUserData: async (uid: string, dataKey: string, data: any) => {
    if (isFirebaseConfigured && db && !isFallbackMode) {
       try {
         await setDoc(doc(db, "users", uid), { [dataKey]: data }, { merge: true });
       } catch (e) {
           console.warn("Firestore save failed, falling back to local", e);
           // If firestore fails (e.g. rules), backup to local
           const storageKey = `analog_data_${uid}_${dataKey}`;
           localStorage.setItem(storageKey, JSON.stringify(data));
       }
    } else {
       const storageKey = `analog_data_${uid}_${dataKey}`;
       localStorage.setItem(storageKey, JSON.stringify(data));
    }
  },

  getUserData: async (uid: string, dataKey: string): Promise<any> => {
    if (isFirebaseConfigured && db && !isFallbackMode) {
       try {
           const snap = await getDoc(doc(db, "users", uid));
           if (snap.exists()) {
            return snap.data()[dataKey] || null;
           }
       } catch(e) {
           console.warn("Firestore read failed", e);
       }
       // Try local backup if firestore returned nothing or failed
       const storageKey = `analog_data_${uid}_${dataKey}`;
       const data = localStorage.getItem(storageKey);
       return data ? JSON.parse(data) : null;
    } else {
        const storageKey = `analog_data_${uid}_${dataKey}`;
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : null;
    }
  }
};
