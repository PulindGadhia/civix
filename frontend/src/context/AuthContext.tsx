/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  GoogleAuthProvider,
  onAuthStateChanged,
  browserSessionPersistence,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage, isFirebaseConfigured } from '../services/firebase';
import axios from 'axios';
import { showToast } from '../utils/toast';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  photoURL: string | null;
  profilePhoto: string | null; // Alias
  role: 'citizen' | 'department_officer' | 'administrator' | 'municipal_admin';
  department?: string | null;
  city: string;
  state: string;
  country: string;
  status: 'Active' | 'Disabled';
  isVerified: boolean;
  createdAt: any;
  lastLogin: any;
  notificationPreferences: {
    email: boolean;
    push: boolean;
  };
  theme: 'dark' | 'light';
  language: 'en' | 'hi' | 'gu';
  permissions: string[];
  reputation?: number;
}

export type RegistrationStatus = 
  | 'IDLE' 
  | 'CREATING_AUTH_USER' 
  | 'UPLOADING_PROFILE_IMAGE' 
  | 'CREATING_FIRESTORE_PROFILE' 
  | 'SENDING_VERIFICATION_EMAIL' 
  | 'SUCCESS' 
  | 'FAILED';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isFirebaseMode: boolean;
  registrationStatus: RegistrationStatus;
  registrationError: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerCitizen: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    photoFile?: File | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>, photoFile?: File | null) => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to run a promise with a timeout
function runWithTimeout<T>(promise: Promise<T>, timeoutMs = 15000, errorMsg = 'Operation timed out.'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>('IDLE');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const isRegisteringRef = useRef<boolean>(false);
  // Holds a ref to the current Firebase user so the interceptor can always access it
  const currentUserRef = useRef<User | null>(null);

  const isFirebaseMode = isFirebaseConfigured === true && auth !== undefined && db !== undefined;

  // ── Axios Request Interceptor ───────────────────────────────────────────────
  // Transparently refresh the Firebase ID token before every API call.
  // Firebase caches the token and only hits the network when it's expired (<5 min left),
  // so this is fast for the overwhelming majority of requests.
  useEffect(() => {
    if (!isFirebaseMode) return;

    const interceptorId = axios.interceptors.request.use(
      async (config) => {
        const fbUser = currentUserRef.current;
        if (fbUser) {
          try {
            // getIdToken() uses Firebase's own cache; only makes a network call when truly needed
            const freshToken = await fbUser.getIdToken(false);
            config.headers = config.headers ?? {};
            config.headers['Authorization'] = `Bearer ${freshToken}`;
          } catch (err) {
            console.error('[AuthInterceptor] Could not refresh token, request may fail:', err);
            // Do NOT block the request — let it go through; the server will 401 if invalid
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Clean up the interceptor when the provider unmounts (important for HMR)
    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, [isFirebaseMode]);
  // ────────────────────────────────────────────────────────────────────────────

  // Sync token header with Axios (still needed for the initial header set at login)
  const syncAxiosHeader = async (firebaseUser: User | null) => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting auth token (session may have expired):', error);
        // Token refresh failed — session is invalid
        showToast('Session expired. Please sign in again.', 'error');
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error('Error during forced sign out:', signOutError);
        }
        setUser(null);
        setUserProfile(null);
        delete axios.defaults.headers.common['Authorization'];
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    if (isFirebaseMode) {
      let unsubscribeProfile: (() => void) | null = null;

      const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        // Clean up previous profile listener if exists
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (!isRegisteringRef.current) {
          setLoading(true);
        }
        try {
          if (firebaseUser) {
            setUser(firebaseUser);
            currentUserRef.current = firebaseUser; // Keep ref in sync for the interceptor
            await syncAxiosHeader(firebaseUser);

            // Set up real-time listener for user profile in Firestore
            const userDocRef = doc(db, 'users', firebaseUser.uid);

            // Real-time listener for profile updates
            unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
              if (docSnap.exists()) {
                const rawData = docSnap.data();
                const cleanedData: any = {};
                if (rawData) {
                  Object.keys(rawData).forEach(key => {
                    const cleanKey = key.endsWith(':') ? key.slice(0, -1) : key;
                    let val = rawData[key];
                    if (typeof val === 'string') {
                      val = val.trim();
                    }
                    cleanedData[cleanKey] = val;
                  });
                }
                const profileData = cleanedData as UserProfile;
                // Keep isVerified synced with Firebase Auth state or user doc
                profileData.isVerified = firebaseUser.emailVerified;
                
                // Account disabled guard: if admin set status to Disabled, sign user out
                if (profileData.status === 'Disabled') {
                  console.warn('Account is disabled. Signing out.');
                  showToast('Your account has been disabled. Please contact the administrator.', 'error');
                  await signOut(auth);
                  return;
                }
                
                if (!isRegisteringRef.current) {
                  setUserProfile(profileData);
                  
                  // Sync axios headers with role for backward compatibility/analytics endpoints
                  axios.defaults.headers.common['X-User-Role'] = profileData.role;
                  axios.defaults.headers.common['X-User-Uid'] = profileData.uid;
                  axios.defaults.headers.common['X-User-Name'] = profileData.fullName;
                  if (profileData.department) {
                    axios.defaults.headers.common['X-User-Department'] = profileData.department;
                  } else {
                    delete axios.defaults.headers.common['X-User-Department'];
                  }
                }
              } else {
                // If user document does not exist yet (during registration), clear profile
                if (!isRegisteringRef.current) {
                  setUserProfile(null);
                }
              }
              if (!isRegisteringRef.current) {
                setLoading(false);
              }
            }, (error) => {
              console.error('Error listening to user profile changes:', error);
              if (!isRegisteringRef.current) {
                setLoading(false);
              }
            });
          } else {
            currentUserRef.current = null; // Clear so interceptor sends no token
            setUser(null);
            setUserProfile(null);
            delete axios.defaults.headers.common['X-User-Role'];
            delete axios.defaults.headers.common['X-User-Uid'];
            delete axios.defaults.headers.common['X-User-Name'];
            delete axios.defaults.headers.common['X-User-Department'];
            await syncAxiosHeader(null);
            setLoading(false);
          }
        } catch (error) {
          console.error('Error in auth state listener:', error);
          setLoading(false);
        }
      });

      return () => {
        unsubscribeAuth();
        if (unsubscribeProfile) {
          unsubscribeProfile();
        }
      };
    } else {
      // Mock Fallback mode (when Firebase is not configured)
      const loadMockSession = () => {
        const savedProfile = localStorage.getItem('community_hero_mock_profile');
        if (savedProfile) {
          try {
            const profile = JSON.parse(savedProfile) as UserProfile;
            setUserProfile(profile);
            setUser({
              uid: profile.uid,
              email: profile.email,
              emailVerified: profile.isVerified,
              displayName: profile.fullName,
              phoneNumber: profile.phone,
              photoURL: profile.photoURL,
              getIdToken: async () => 'mock-id-token'
            } as unknown as User);

            axios.defaults.headers.common['X-User-Role'] = profile.role;
            axios.defaults.headers.common['X-User-Uid'] = profile.uid;
            axios.defaults.headers.common['X-User-Name'] = profile.fullName;
            if (profile.department) {
              axios.defaults.headers.common['X-User-Department'] = profile.department;
            }
          } catch (e) {
            console.error('Failed to parse mock profile:', e);
          }
        }
        setLoading(false);
      };

      loadMockSession();
    }
  }, [isFirebaseMode]);

  // Handle Login
  const login = useCallback(async (email: string, password: string, rememberMe = true) => {
    if (isFirebaseMode) {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Update lastLogin in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await updateDoc(userDocRef, {
        lastLogin: serverTimestamp(),
        isVerified: userCredential.user.emailVerified
      }).catch(err => console.log('Could not update last login timestamp:', err));
    } else {
      // Mock Login Fallback
      let role: UserProfile['role'] = 'citizen';
      let name = 'Mock Citizen';
      let dept: string | undefined = undefined;
      let uid = 'mock-citizen-uid';

      if (email.includes('officer')) {
        role = 'department_officer';
        name = 'Officer Rajesh Kumar';
        dept = 'roads';
        uid = 'officer-roads-1';
      } else if (email.includes('admin')) {
        role = 'administrator';
        name = 'Mock Administrator';
        uid = 'mock-admin-uid';
      }

      const mockProfile: UserProfile = {
        uid,
        fullName: name,
        email,
        phone: '+91 98765 43210',
        photoURL: null,
        profilePhoto: null,
        role,
        department: dept,
        city: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        status: 'Active',
        isVerified: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        notificationPreferences: { email: true, push: true },
        theme: 'dark',
        language: 'en',
        permissions: []
      };

      localStorage.setItem('community_hero_mock_profile', JSON.stringify(mockProfile));
      setUserProfile(mockProfile);
      setUser({
        uid: mockProfile.uid,
        email: mockProfile.email,
        emailVerified: true,
        displayName: mockProfile.fullName,
        photoURL: null,
        getIdToken: async () => 'mock-id-token'
      } as unknown as User);

      axios.defaults.headers.common['X-User-Role'] = mockProfile.role;
      axios.defaults.headers.common['X-User-Uid'] = mockProfile.uid;
      axios.defaults.headers.common['X-User-Name'] = mockProfile.fullName;
      if (mockProfile.department) {
        axios.defaults.headers.common['X-User-Department'] = mockProfile.department;
      }
      showToast('Logged in successfully (Mock Mode)', 'success');
    }
  }, [isFirebaseMode]);

  // Google Sign In
  const loginWithGoogle = useCallback(async () => {
    if (isFirebaseMode) {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        const defaultProfile: UserProfile = {
          uid: userCredential.user.uid,
          fullName: userCredential.user.displayName || 'Google User',
          email: userCredential.user.email || '',
          phone: userCredential.user.phoneNumber || '',
          photoURL: userCredential.user.photoURL || null,
          profilePhoto: userCredential.user.photoURL || null,
          role: 'citizen',
          city: 'Ahmedabad',
          state: 'Gujarat',
          country: 'India',
          status: 'Active',
          isVerified: userCredential.user.emailVerified,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          notificationPreferences: { email: true, push: true },
          theme: 'dark',
          language: 'en',
          permissions: []
        };
        await setDoc(userDocRef, defaultProfile);
      } else {
        await updateDoc(userDocRef, {
          lastLogin: serverTimestamp()
        });
      }
    } else {
      // Mock Google Login
      await login('google-citizen@hero.com', 'password');
    }
  }, [isFirebaseMode, login]);

  // Citizen Registration
  const registerCitizen = useCallback(async (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    photoFile?: File | null;
  }) => {
    console.log('[REGISTRATION DEBUG] registerCitizen invoked with:', {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      city: data.city,
      hasPhotoFile: !!data.photoFile
    });
    setRegistrationError(null);
    if (isFirebaseMode) {
      isRegisteringRef.current = true;
      let createdUser: User | null = null;
      let uploadedPhotoRef: any = null;
      let createdDocRef: any = null;

      try {
        // Step 1: Create Auth User
        console.log('[REGISTRATION DEBUG] STEP 1: Creating Auth User...');
        setRegistrationStatus('CREATING_AUTH_USER');
        const userCredential = await runWithTimeout(
          createUserWithEmailAndPassword(auth, data.email, data.password),
          15000,
          'Creating authentication user timed out.'
        );
        createdUser = userCredential.user;
        console.log('[REGISTRATION DEBUG] STEP 1 COMPLETE. Auth User UID:', createdUser.uid);

        // Step 2: Upload Profile Image if available
        let photoURL: string | null = null;
        if (data.photoFile) {
          console.log('[REGISTRATION DEBUG] STEP 2: Uploading Profile Image...');
          setRegistrationStatus('UPLOADING_PROFILE_IMAGE');
          const fileRef = ref(storage, `users/${createdUser.uid}/profile.jpg`);
          uploadedPhotoRef = fileRef;
          const uploadResult = await runWithTimeout(
            uploadBytes(fileRef, data.photoFile),
            15000,
            'Uploading profile image timed out.'
          );
          photoURL = await runWithTimeout(
            getDownloadURL(uploadResult.ref),
            10000,
            'Retrieving profile image URL timed out.'
          );
          console.log('[REGISTRATION DEBUG] STEP 2 COMPLETE. Photo URL:', photoURL);
        } else {
          console.log('[REGISTRATION DEBUG] STEP 2 SKIPPED (No profile image).');
        }

        // Step 3: Create Firestore Document
        console.log('[REGISTRATION DEBUG] STEP 3: Creating Firestore Document users/{uid}...');
        setRegistrationStatus('CREATING_FIRESTORE_PROFILE');
        const userDocRef = doc(db, 'users', createdUser.uid);
        createdDocRef = userDocRef;
        const newProfile: UserProfile = {
          uid: createdUser.uid,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          photoURL,
          profilePhoto: photoURL,
          role: 'citizen',
          city: data.city,
          state: 'Gujarat',
          country: 'India',
          status: 'Active',
          isVerified: false,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          notificationPreferences: { email: true, push: true },
          theme: 'dark',
          language: 'en',
          permissions: []
        };

        await runWithTimeout(
          setDoc(userDocRef, newProfile),
          15000,
          'Creating user profile document timed out.'
        );
        console.log('[REGISTRATION DEBUG] STEP 3 COMPLETE. Firestore profile created.');
        
        // Step 4: Send Email Verification
        console.log('[REGISTRATION DEBUG] STEP 4: Sending Verification Email...');
        setRegistrationStatus('SENDING_VERIFICATION_EMAIL');
        await runWithTimeout(
          sendEmailVerification(createdUser),
          15000,
          'Sending verification email timed out.'
        );
        console.log('[REGISTRATION DEBUG] STEP 4 COMPLETE. Verification email sent.');
        
        setRegistrationStatus('SUCCESS');
        isRegisteringRef.current = false;

        setUserProfile(newProfile);
        axios.defaults.headers.common['X-User-Role'] = newProfile.role;
        axios.defaults.headers.common['X-User-Uid'] = newProfile.uid;
        axios.defaults.headers.common['X-User-Name'] = newProfile.fullName;

        console.log('[REGISTRATION DEBUG] REGISTRATION PIPELINE SUCCESS.');
        showToast('Registration successful! Verification email sent.', 'success');
      } catch (err: any) {
        isRegisteringRef.current = false;
        setRegistrationStatus('FAILED');
        const errMsg = err.message || 'Registration failed.';
        setRegistrationError(errMsg);
        console.error('[REGISTRATION DEBUG] REGISTRATION PIPELINE FAILED. Error:', errMsg);
        console.error('Registration failed, rolling back...', err);
        // Rollback Firestore doc
        if (createdDocRef) {
          console.log('[REGISTRATION DEBUG] ROLLING BACK: Deleting Firestore profile...');
          await deleteDoc(createdDocRef).catch(docErr => console.error('[REGISTRATION DEBUG] Rollback Firestore doc failed:', docErr));
        }
        // Rollback Storage object
        if (uploadedPhotoRef) {
          console.log('[REGISTRATION DEBUG] ROLLING BACK: Deleting profile photo...');
          await deleteObject(uploadedPhotoRef).catch(storeErr => console.error('[REGISTRATION DEBUG] Rollback Storage photo failed:', storeErr));
        }
        // Rollback Auth user
        if (createdUser) {
          console.log('[REGISTRATION DEBUG] ROLLING BACK: Deleting Auth user...');
          await createdUser.delete().catch(authErr => console.error('[REGISTRATION DEBUG] Rollback Auth user failed:', authErr));
        }
        throw err;
      }
    } else {
      // Mock Register Fallback
      isRegisteringRef.current = true;
      setRegistrationError(null);
      try {
        console.log('[REGISTRATION DEBUG] [MOCK] STEP 1: Creating Auth User...');
        setRegistrationStatus('CREATING_AUTH_USER');
        await new Promise(resolve => setTimeout(resolve, 400));
        console.log('[REGISTRATION DEBUG] [MOCK] STEP 1 COMPLETE.');
        
        console.log('[REGISTRATION DEBUG] [MOCK] STEP 3: Creating Firestore Document...');
        setRegistrationStatus('CREATING_FIRESTORE_PROFILE');
        await new Promise(resolve => setTimeout(resolve, 400));
        console.log('[REGISTRATION DEBUG] [MOCK] STEP 3 COMPLETE.');
        
        console.log('[REGISTRATION DEBUG] [MOCK] STEP 4: Sending Verification Email...');
        setRegistrationStatus('SENDING_VERIFICATION_EMAIL');
        await new Promise(resolve => setTimeout(resolve, 400));
        console.log('[REGISTRATION DEBUG] [MOCK] STEP 4 COMPLETE.');

        const uid = `mock-user-${Math.random().toString(36).substring(2, 9)}`;
        const mockProfile: UserProfile = {
          uid,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          photoURL: null,
          profilePhoto: null,
          role: 'citizen',
          city: data.city,
          state: 'Gujarat',
          country: 'India',
          status: 'Active',
          isVerified: true, // Auto verified in mock
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          notificationPreferences: { email: true, push: true },
          theme: 'dark',
          language: 'en',
          permissions: []
        };

        localStorage.setItem('community_hero_mock_profile', JSON.stringify(mockProfile));
        setUserProfile(mockProfile);
        setUser({
          uid: mockProfile.uid,
          email: mockProfile.email,
          emailVerified: true,
          displayName: mockProfile.fullName,
          photoURL: null,
          getIdToken: async () => 'mock-id-token'
        } as unknown as User);

        axios.defaults.headers.common['X-User-Role'] = mockProfile.role;
        axios.defaults.headers.common['X-User-Uid'] = mockProfile.uid;
        axios.defaults.headers.common['X-User-Name'] = mockProfile.fullName;

        setRegistrationStatus('SUCCESS');
        isRegisteringRef.current = false;
        console.log('[REGISTRATION DEBUG] [MOCK] REGISTRATION PIPELINE SUCCESS.');
        showToast('Mock registration successful!', 'success');
      } catch (err: any) {
        isRegisteringRef.current = false;
        setRegistrationStatus('FAILED');
        setRegistrationError(err.message || 'Mock registration failed.');
        console.error('[REGISTRATION DEBUG] [MOCK] REGISTRATION PIPELINE FAILED. Error:', err.message);
        throw err;
      }
    }
  }, [isFirebaseMode]);

  // Reset Password
  const resetPassword = useCallback(async (email: string) => {
    if (isFirebaseMode) {
      await sendPasswordResetEmail(auth, email);
      showToast('Password reset email sent!', 'success');
    } else {
      showToast('Password reset email simulated in mock mode.', 'info');
    }
  }, [isFirebaseMode]);

  // Logout
  const logout = useCallback(async () => {
    if (isFirebaseMode) {
      await signOut(auth);
    } else {
      localStorage.removeItem('community_hero_mock_profile');
      setUser(null);
      setUserProfile(null);
      delete axios.defaults.headers.common['X-User-Role'];
      delete axios.defaults.headers.common['X-User-Uid'];
      delete axios.defaults.headers.common['X-User-Name'];
      delete axios.defaults.headers.common['X-User-Department'];
      delete axios.defaults.headers.common['Authorization'];
      showToast('Logged out (Mock Mode)', 'info');
    }
  }, [isFirebaseMode]);

  // Update Profile & Photo
  const updateProfile = useCallback(async (data: Partial<UserProfile>, photoFile?: File | null) => {
    if (isFirebaseMode && user) {
      const userDocRef = doc(db, 'users', user.uid);
      
      let updatedPhotoURL: string | undefined = undefined;
      if (photoFile) {
        const fileRef = ref(storage, `users/${user.uid}/profile.jpg`);
        const uploadResult = await uploadBytes(fileRef, photoFile);
        updatedPhotoURL = await getDownloadURL(uploadResult.ref);
      }

      const updateData = {
        ...data,
        ...(updatedPhotoURL !== undefined ? { photoURL: updatedPhotoURL, profilePhoto: updatedPhotoURL } : {})
      };

      await updateDoc(userDocRef, updateData);
      showToast('Profile updated successfully!', 'success');
    } else if (userProfile) {
      // Mock update
      const updatedProfile = {
        ...userProfile,
        ...data
      };
      localStorage.setItem('community_hero_mock_profile', JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);
      showToast('Profile updated in mock mode!', 'success');
    }
  }, [isFirebaseMode, user, userProfile]);

  // Resend Verification Email
  const resendVerification = useCallback(async () => {
    if (isFirebaseMode && auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      showToast('Verification email resent!', 'success');
    } else {
      showToast('Verification email resent simulated.', 'info');
    }
  }, [isFirebaseMode]);

  const contextValue = useMemo(() => ({
    user,
    userProfile,
    loading,
    isFirebaseMode,
    login,
    loginWithGoogle,
    registerCitizen,
    logout,
    resetPassword,
    updateProfile,
    resendVerification,
    registrationStatus,
    registrationError
  }), [
    user,
    userProfile,
    loading,
    isFirebaseMode,
    login,
    loginWithGoogle,
    registerCitizen,
    logout,
    resetPassword,
    updateProfile,
    resendVerification,
    registrationStatus,
    registrationError
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
