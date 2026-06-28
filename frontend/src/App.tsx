/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { 
  LandingPage, 
  LoginPage, 
  RegisterPage, 
  ForgotPasswordPage, 
  EmailVerificationPage, 
  SplashPage, 
  UnauthorizedPage, 
  NotFoundPage 
} from './components/auth/AuthPages';
import { ProfileModal } from './components/auth/ProfileModal';
import axios from 'axios';
import { 
  Activity, 
  Layers, 
  MapPin,
  X,
  User,
  LayoutDashboard,
  Map as MapIcon,
  Sun,
  Moon
} from 'lucide-react';
import { Logo } from './components/layout/Logo';
const LeafletMapContainer = lazy(() =>
  import('./components/map/LeafletMapContainer').then(m => ({ default: m.LeafletMapContainer }))
);
import { IncidentReportForm } from './components/layout/IncidentReportForm';
import { DashboardWidgets } from './components/layout/DashboardWidgets';
import { FloatingAssistant } from './components/layout/FloatingAssistant';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { IssueVerificationPanel } from './components/verification/IssueVerificationPanel';
import { IssueCommentsSection } from './components/verification/IssueCommentsSection';
import { ToastNotifications } from './components/verification/ToastNotifications';
import { showToast } from './utils/toast';
import { UpdateStatusModal } from './components/verification/UpdateStatusModal';
import { IssueLifecycleTimeline } from './components/verification/IssueLifecycleTimeline';
import { collection, onSnapshot, doc, query, where, or } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './services/firebase';

import { SearchFilterBar } from './components/layout/SearchFilterBar';
import { NotificationCenter } from './components/layout/NotificationCenter';
import { CitizenDashboard } from './components/dashboard/CitizenDashboard';
import { DepartmentDashboard } from './components/dashboard/DepartmentDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';

const API_BASE_URL = 'http://localhost:8000';

export interface Issue {
  id: string;
  citizenId: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  category: string;
  severity: string;
  priorityScore: number;
  status: string;
  upvotesCount: number;
  publicImageUrl?: string | null;
  department?: string;
  progress_percentage?: number;
  after_image_urls?: string[];
  completion_notes?: string;
  createdAt?: string;
  updatedAt?: string;
  verificationCount?: number;
  disputeCount?: number;
  confidenceScore?: number;
  officer_id?: string;
  officer_name?: string;
  resolver_officer_name?: string;
  aiConfidence?: number;
  aiAnalysis?: string;
  aiSummary?: string;
  technician_name?: string;
  inspection_date?: string;
  material_used?: string;
  estimated_cost?: number;
  citizen_verified?: boolean;
  resolution_date?: string;
  city?: string;
  priority?: string;
  escalated?: boolean;
  deadline?: string;
  estimated_completion_date?: string;
  internal_notes?: string;
  citizen_rating?: number;
  citizen_feedback?: string;
}

interface AddressDetails {
  rawAddress: string;
  houseNumber: string;
  street: string;
  area: string;
  locality: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
}

function App() {
  const { user, userProfile, loading, updateProfile } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Theme state: light or dark
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('civix_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    return systemPrefersLight ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('civix_theme', theme);
  }, [theme]);

  // Connection states
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [responseTime, setResponseTime] = useState<string>('');
  
  // Issues states
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(null);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isReporting, setIsReporting] = useState<boolean>(false);
  
  // Lifecycle states
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Derived state from profile
  const reputation = userProfile?.reputation || 0;

  // Derived current user object for backward compatibility
  const currentUser = useMemo(() => userProfile ? {
    uid: userProfile.uid,
    role: userProfile.role,
    name: userProfile.fullName,
    department: userProfile.department || undefined
  } : {
    uid: '',
    role: 'citizen' as const,
    name: 'Anonymous',
    department: undefined
  }, [userProfile]);

  const [activeTab, setActiveTab] = useState<'map' | 'dashboard'>('map');
  const [filters, setFilters] = useState<{
    category?: string;
    status?: string;
    department?: string;
    priority?: string;
    severity?: string;
    city?: string;
    searchQuery?: string;
  }>({});

  // Memoize filtered issues to support client-side filtering in Firestore mode
  const filteredIssues = useMemo(() => {
    let result = issues;
    if (filters.category) {
      result = result.filter(i => i.category === filters.category);
    }
    if (filters.status) {
      result = result.filter(i => i.status === filters.status);
    }
    if (filters.department) {
      result = result.filter(i => i.department === filters.department);
    }
    if (filters.severity) {
      result = result.filter(i => i.severity === filters.severity);
    }
    if (filters.city) {
      const cityFilter = filters.city.toLowerCase();
      result = result.filter(i => i.city?.toLowerCase().includes(cityFilter));
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(i => 
        i.title.toLowerCase().includes(query) || 
        i.description.toLowerCase().includes(query)
      );
    }
    return result;
  }, [issues, filters]);

  // Auto switch tab based on role
  useEffect(() => {
    if (userProfile) {
      if (userProfile.role !== 'citizen') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('map');
      }
    }
  }, [userProfile]);

  // Fetch reported issues from FastAPI
  const fetchIssues = useCallback(async () => {
    setIsLoadingIssues(true);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.department) params.append('department', filters.department);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.city) params.append('city', filters.city);
      
      const response = await axios.get(`${API_BASE_URL}/api/v1/issues?${params.toString()}`);
      let resultIssues = response.data;
      
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        resultIssues = resultIssues.filter((i: Issue) => 
          i.title.toLowerCase().includes(query) || 
          i.description.toLowerCase().includes(query)
        );
      }
      
      setIssues(resultIssues);
    } catch (error) {
      console.error('Error loading issues from database:', error);
    } finally {
      setIsLoadingIssues(false);
    }
  }, [filters]);

  // Sync Axios headers with active User Role
  useEffect(() => {
    if (currentUser.uid) {
      axios.defaults.headers.common['X-User-Role'] = currentUser.role;
      axios.defaults.headers.common['X-User-Uid'] = currentUser.uid;
      axios.defaults.headers.common['X-User-Name'] = currentUser.name;
      if (currentUser.department) {
        axios.defaults.headers.common['X-User-Department'] = currentUser.department;
      } else {
        delete axios.defaults.headers.common['X-User-Department'];
      }
    } else {
      delete axios.defaults.headers.common['X-User-Role'];
      delete axios.defaults.headers.common['X-User-Uid'];
      delete axios.defaults.headers.common['X-User-Name'];
      delete axios.defaults.headers.common['X-User-Department'];
    }
  }, [currentUser.uid, currentUser.role, currentUser.name, currentUser.department]);


  // Re-fetch when filters change in local mode
  useEffect(() => {
    if (!isFirebaseConfigured) {
      fetchIssues();
    }
  }, [filters, fetchIssues]);

  // Handle Citizen Resolution Verification/Dispute
  const handleVerifyResolution = async (issueId: string, verified: boolean, rating?: number, feedback?: string) => {
    try {
      const formData = new FormData();
      formData.append('status', verified ? 'closed' : 'reopened');
      formData.append('updated_by', currentUser.name);
      formData.append('notes', verified ? 'Citizen verified repair work completion.' : 'Citizen rejected repair work.');
      formData.append('citizen_verified', verified ? 'true' : 'false');
      if (rating) {
        formData.append('rating', rating.toString());
      }
      if (feedback) {
        formData.append('feedback', feedback);
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/issues/${issueId}/status`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      if (response.data.success) {
        showToast(verified ? 'Incident verified and closed!' : 'Resolution rejected. Reopened!', 'success');
        fetchIssues();
        if (activeIssue && activeIssue.id === issueId) {
          setActiveIssue(response.data.issue);
        }
      }
    } catch (err) {
      console.error('Verification error:', err);
      showToast('Failed to update resolution verification status.', 'error');
    }
  };

  // Check backend connection health
  const checkConnection = useCallback(async () => {
    const startTime = performance.now();
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      const duration = (performance.now() - startTime).toFixed(0);
      setResponseTime(`${duration}ms`);
      if (response.data && response.data.status === 'healthy') {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
      setResponseTime('');
    }
  }, []);

  // Ref to always have the latest fetchIssues callback in the mount-only effect
  const fetchIssuesRef = useRef(fetchIssues);
  useEffect(() => {
    fetchIssuesRef.current = fetchIssues;
  }, [fetchIssues]);

  // Ref to hold current activeIssue data — used by the Firestore snapshot callback
  // without making the snapshot effect react to every field change.
  const activeIssueRef = useRef<Issue | null>(activeIssue);
  useEffect(() => {
    activeIssueRef.current = activeIssue;
  }, [activeIssue]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000); // Check connection health every 15s

    let unsubscribe: (() => void) | undefined;

    // Wait until auth has resolved before setting up the listener to avoid firing with an empty uid
    if (!loading && isFirebaseConfigured && db && currentUser.uid) {
      setIsLoadingIssues(true);
      try {
        let q;
        if (currentUser.role === 'administrator' || currentUser.role === 'municipal_admin') {
          q = query(collection(db, 'issues'));
        } else if (currentUser.role === 'department_officer') {
          q = query(
            collection(db, 'issues'),
            or(
              where('department', '==', currentUser.department || ''),
              where('officer_id', '==', currentUser.uid)
            )
          );
        } else {
          // Default to citizen
          q = query(
            collection(db, 'issues'),
            where('ownerUid', '==', currentUser.uid)
          );
        }

        unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedIssues: Issue[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const issueData = { ...data } as any;
            if (issueData.createdAt && typeof issueData.createdAt.toDate === 'function') {
              issueData.createdAt = issueData.createdAt.toDate().toISOString();
            }
            if (issueData.updatedAt && typeof issueData.updatedAt.toDate === 'function') {
              issueData.updatedAt = issueData.updatedAt.toDate().toISOString();
            }
            if (issueData.resolution_date && typeof issueData.resolution_date.toDate === 'function') {
              issueData.resolution_date = issueData.resolution_date.toDate().toISOString();
            }
            fetchedIssues.push(issueData);
          });
          // Sort by createdAt descending
          fetchedIssues.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
          
          // Guard setIssues to only update when the new issues are actually different from current ones
          setIssues((prevIssues) => {
            if (prevIssues.length === fetchedIssues.length && 
                prevIssues.every((val, idx) => 
                  val.id === fetchedIssues[idx].id && 
                  val.status === fetchedIssues[idx].status && 
                  val.progress_percentage === fetchedIssues[idx].progress_percentage && 
                  val.upvotesCount === fetchedIssues[idx].upvotesCount &&
                  val.updatedAt === fetchedIssues[idx].updatedAt)) {
              return prevIssues;
            }
            return fetchedIssues;
          });
          setIsLoadingIssues(false);
        }, (error) => {
          console.error('Firestore issues snapshot error, falling back to API:', error);
          fetchIssuesRef.current();
        });
      } catch (err) {
        console.error('Failed to setup Firestore issues listener:', err);
        fetchIssuesRef.current();
      }
    } else {
      fetchIssuesRef.current();
    }

    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, [checkConnection, loading, currentUser.uid, currentUser.role, currentUser.department]);

  useEffect(() => {
    if (!activeIssue) return;

    let unsubscribe: (() => void) | undefined;

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'issues', activeIssue.id);
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const freshIssue = { ...data } as any;
            if (freshIssue.createdAt && typeof freshIssue.createdAt.toDate === 'function') {
              freshIssue.createdAt = freshIssue.createdAt.toDate().toISOString();
            }
            if (freshIssue.updatedAt && typeof freshIssue.updatedAt.toDate === 'function') {
              freshIssue.updatedAt = freshIssue.updatedAt.toDate().toISOString();
            }
            if (freshIssue.resolution_date && typeof freshIssue.resolution_date.toDate === 'function') {
              freshIssue.resolution_date = freshIssue.resolution_date.toDate().toISOString();
            }

            // Read the current active issue from the ref (no re-subscription needed)
            const currentIssue = activeIssueRef.current;
            if (!currentIssue) return;

            const statusChanged = freshIssue.status !== currentIssue.status;
            const progressChanged = freshIssue.progress_percentage !== currentIssue.progress_percentage;
            const statsChanged =
              freshIssue.upvotesCount !== currentIssue.upvotesCount ||
              freshIssue.verificationCount !== currentIssue.verificationCount ||
              freshIssue.disputeCount !== currentIssue.disputeCount ||
              freshIssue.confidenceScore !== currentIssue.confidenceScore;
            const timeChanged = freshIssue.updatedAt !== currentIssue.updatedAt;

            if (statusChanged || progressChanged || statsChanged || timeChanged) {
              if (statusChanged) {
                showToast(`Issue status advanced: ${freshIssue.status.replace(/_/g, ' ').toUpperCase()}`, 'info');
              }
              setActiveIssue(freshIssue);
              setRefreshTrigger((prev) => prev + 1);
            }
          }
        }, (error) => {
          console.error('Firestore active issue snapshot error:', error);
        });
      } catch (err) {
        console.error('Failed to setup active issue listener:', err);
      }
    } else {
      const pollActiveIssue = async () => {
        try {
          const currentIssue = activeIssueRef.current;
          if (!currentIssue) return;
          const response = await axios.get(`${API_BASE_URL}/api/v1/issues/${currentIssue.id}`);
          const freshIssue = response.data;
          const statusChanged = freshIssue.status !== currentIssue.status;
          const progressChanged = freshIssue.progress_percentage !== currentIssue.progress_percentage;
          const statsChanged =
            freshIssue.upvotesCount !== currentIssue.upvotesCount ||
            freshIssue.verificationCount !== currentIssue.verificationCount ||
            freshIssue.disputeCount !== currentIssue.disputeCount ||
            freshIssue.confidenceScore !== currentIssue.confidenceScore;
          const timeChanged = freshIssue.updatedAt !== currentIssue.updatedAt;

          if (statusChanged || progressChanged || statsChanged || timeChanged) {
            if (statusChanged) {
              showToast(`Issue status advanced: ${freshIssue.status.replace(/_/g, ' ').toUpperCase()}`, 'info');
            }
            setActiveIssue(freshIssue);
            setRefreshTrigger((prev) => prev + 1);
          }
        } catch (error) {
          console.error('Error polling active issue:', error);
        }
      };

      const pollInterval = setInterval(pollActiveIssue, 7000); // poll every 7 seconds
      return () => clearInterval(pollInterval);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  // Only re-create the listener when the selected issue ID changes, not its data fields
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIssue?.id]);

  // Handle map selection
  const handleLocationSelected = useCallback((lat: number, lng: number, details: AddressDetails) => {
    setSelectedLocation({ lat, lng });
    setAddressDetails(details);
    setIsReporting(true);
    setActiveIssue(null); // Close active issue card if reporting new one
  }, []);

  // Handle marker click
  const handleMarkerClick = useCallback((issue: Issue) => {
    setActiveIssue(issue);
    setIsReporting(false); // Close reporting form if viewing details
  }, []);

  // Upvote issue handler
  const handleUpvoteIssue = useCallback(async (issueId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/v1/issues/${issueId}/upvote`);
      if (userProfile) {
        await updateProfile({
          reputation: (userProfile.reputation || 0) + 10
        });
      }
      fetchIssues(); // Refresh list to get updated count
    } catch (error) {
      console.error('Failed to upvote issue:', error);
    }
  }, [userProfile, updateProfile, fetchIssues]);

  // Submit success callback
  const handleSubmitSuccess = useCallback(() => {
    if (userProfile) {
      updateProfile({
        reputation: (userProfile.reputation || 0) + 50
      }).catch(err => console.error('Failed to update reputation:', err));
    }
    setSelectedLocation(null);
    setAddressDetails(null);
    setIsReporting(false);
    fetchIssues(); // Reload issues list
  }, [userProfile, updateProfile, fetchIssues]);

  // Aggregate dashboard stats
  const { totalIssues, resolvedIssues, pendingIssues, criticalIssues } = useMemo(() => ({
    totalIssues: filteredIssues.length,
    resolvedIssues: filteredIssues.filter(i => i.status === 'resolved' || i.status === 'closed').length,
    pendingIssues: filteredIssues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length,
    criticalIssues: filteredIssues.filter(i => i.severity === 'critical' && i.status !== 'closed').length,
  }), [filteredIssues]);

  if (loading) {
    return <SplashPage />;
  }

  // 1. Unauthenticated Router
  const publicPaths = ['/', '/login', '/register', '/forgot-password', '/verify-email', '/unauthorized'];
  const isPublicPath = publicPaths.includes(location.pathname);

  if (!user || !userProfile) {
    if (!isPublicPath) {
      return <Navigate to="/login" replace />;
    }
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 2. Email Verification Check (Firebase Mode Only)
  if (isFirebaseConfigured && !user.emailVerified && userProfile.role === 'citizen') {
    if (location.pathname !== '/verify-email') {
      return <Navigate to="/verify-email" replace />;
    }
    return (
      <Routes>
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="*" element={<Navigate to="/verify-email" replace />} />
      </Routes>
    );
  }

  // 3. Authenticated Public Redirects
  if (['/', '/login', '/register', '/forgot-password', '/verify-email'].includes(location.pathname)) {
    if (userProfile.role === 'citizen') return <Navigate to="/citizen" replace />;
    if (userProfile.role === 'department_officer') return <Navigate to="/officer" replace />;
    if (userProfile.role === 'administrator' || userProfile.role === 'municipal_admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. Role Authorization Guards
  if (location.pathname === '/citizen' && userProfile.role !== 'citizen') {
    return <Navigate to="/unauthorized" replace />;
  }
  if (location.pathname === '/officer' && userProfile.role !== 'department_officer') {
    return <Navigate to="/unauthorized" replace />;
  }
  if (location.pathname === '/admin' && userProfile.role !== 'administrator' && userProfile.role !== 'municipal_admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  // 5. Unauthorized Page rendering when logged in
  if (location.pathname === '/unauthorized') {
    return <UnauthorizedPage />;
  }

  // 6. Unknown route -> 404
  const validWorkspacePaths = ['/citizen', '/officer', '/admin'];
  if (!validWorkspacePaths.includes(location.pathname)) {
    return (
      <Routes>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400">
      
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size="navbar" />
            <span className="hidden md:inline px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Civic Platform
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer shadow-sm"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4 text-violet-400 animate-pulse" /> : <Sun className="h-4 w-4 text-amber-400 animate-pulse" />}
            </button>

            {/* User Profile Trigger */}
            {userProfile && (
              <button 
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-855 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm animate-scaleUp"
              >
                <div className="h-5 w-5 rounded-full bg-slate-950 border border-slate-805 overflow-hidden flex items-center justify-center shrink-0">
                  {userProfile.photoURL ? (
                    <img src={userProfile.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-3 w-3 text-slate-400" />
                  )}
                </div>
                <span className="hidden sm:inline max-w-[80px] truncate">{userProfile.fullName}</span>
              </button>
            )}

            {/* Notification Bell Dropdown */}
            {currentUser && (
              <NotificationCenter apiBaseUrl={API_BASE_URL} currentUser={currentUser} issues={issues} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        
        {/* Module Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Layers className="h-7 w-7 text-emerald-400" />
              {currentUser.role === 'citizen' 
                ? 'CiviX Platform' 
                : currentUser.role === 'department_officer' 
                  ? 'Officer Command Center' 
                  : 'Municipal Administration'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {currentUser.role === 'citizen' 
                ? 'Report infrastructure issues, vote on verifications, and improve your local neighborhood.' 
                : currentUser.role === 'department_officer' 
                  ? 'Manage assigned municipal tickets, update maintenance statuses, and inspect resolving tasks.' 
                  : 'Executive city operations overview: assign departments, analyze officer workload, and audit system performance.'}
            </p>
          </div>
          <button
            onClick={fetchIssues}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            Sync Database
          </button>
        </div>

        {/* Tab switch bar */}
        <div className="flex border-b border-slate-850 gap-6">
          <button
            onClick={() => setActiveTab('map')}
            className={`pb-3 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'map' 
                ? 'border-emerald-500 text-white font-extrabold' 
                : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            {currentUser.role === 'citizen' 
              ? 'Central Incident Map' 
              : currentUser.role === 'department_officer' 
                ? 'Operational Ticket Map' 
                : 'Executive System Map'}
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'border-emerald-500 text-white font-extrabold' 
                : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            {currentUser.role === 'citizen' 
              ? 'My Incident Dashboard' 
              : currentUser.role === 'department_officer' 
                ? 'Department Work Queue' 
                : 'Executive Admin Dashboard'}
          </button>
        </div>

        {/* Conditional Tab Rendering */}
        {activeTab === 'map' ? (
          <div className="space-y-8 animate-fadeIn">
            {/* Search and Filters Bar */}
            <SearchFilterBar 
              onFilterChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
              onReset={() => setFilters({})}
            />

            {/* Map & Report Drawer Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Map Area */}
              <div className="lg:col-span-2 space-y-4">
                  <ErrorBoundary>
                    <Suspense fallback={
                      <div className="w-full h-[550px] bg-slate-900/40 border border-slate-800/80 rounded-3xl flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-3">
                        <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                        <span>Loading interactive map engine...</span>
                      </div>
                    }>
                      <LeafletMapContainer 
                        issues={filteredIssues}
                        selectedLocation={selectedLocation}
                        onLocationSelected={handleLocationSelected}
                        onMarkerClick={handleMarkerClick}
                      />
                    </Suspense>
                  </ErrorBoundary>
                {isLoadingIssues && (
                  <div className="text-center text-[10px] text-slate-500 animate-pulse">
                    Syncing records with Cloud Firestore...
                  </div>
                )}
              </div>

              {/* Incident Report Panel / Form Drawer */}
              <div className="h-[520px]">
                {isReporting && selectedLocation ? (
                  <IncidentReportForm
                    selectedLocation={selectedLocation}
                    addressDetails={addressDetails}
                    onCancel={() => {
                      setSelectedLocation(null);
                      setAddressDetails(null);
                      setIsReporting(false);
                    }}
                    onSubmitSuccess={handleSubmitSuccess}
                    apiBaseUrl={API_BASE_URL}
                  />
                ) : activeIssue ? (
                  // Active Issue Details Panel
                  <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl p-6 text-slate-200">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4 shrink-0">
                      <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                          activeIssue.severity === 'high' || activeIssue.severity === 'critical'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-450' 
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                          {activeIssue.category} • {activeIssue.severity}
                        </span>
                        <h3 className="text-base font-bold text-white mt-1.5 leading-snug">{activeIssue.title}</h3>
                      </div>
                      <button 
                        onClick={() => setActiveIssue(null)}
                        className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Scrollable container for details, verification controls, and comments */}
                    <div className="flex-1 overflow-y-auto space-y-5 pr-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                      <p className="text-xs text-slate-400 leading-relaxed">{activeIssue.description}</p>
                      
                      <div className="flex gap-2.5 text-[10px] text-slate-400 bg-slate-950 p-3.5 rounded-xl border border-slate-900">
                        <MapPin className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-300 leading-normal">{activeIssue.address}</p>
                          <div className="flex gap-4 mt-1.5 text-[9px] text-slate-500 font-mono">
                            <span>LAT: {activeIssue.latitude.toFixed(5)}</span>
                            <span>LNG: {activeIssue.longitude.toFixed(5)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stepper progress bar */}
                      <div className="space-y-1.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-900">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Lifecycle Progress</span>
                          <span className="text-emerald-400 font-mono font-bold">{activeIssue.progress_percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500" 
                            style={{ width: `${activeIssue.progress_percentage || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[7px] text-slate-500 font-black uppercase">
                          <span>Reported</span>
                          <span>Assigned</span>
                          <span>WIP</span>
                          <span>Resolved</span>
                        </div>
                      </div>

                      {activeIssue.publicImageUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-900 h-36 bg-slate-950">
                          <img 
                            src={activeIssue.publicImageUrl} 
                            alt={activeIssue.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Detailed Resolution Panel */}
                      {activeIssue.status === 'resolved' && (
                        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-3">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                            Completion Certificate Details
                          </span>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="block text-[8px] text-slate-500 font-bold uppercase text-center">Before</span>
                              <div className="rounded-xl overflow-hidden border border-slate-900 h-24 bg-slate-950">
                                <img 
                                  src={activeIssue.publicImageUrl || ''} 
                                  alt="Before" 
                                  className="w-full h-full object-cover" 
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="block text-[8px] text-slate-500 font-bold uppercase text-center text-emerald-400">After</span>
                              <div className="rounded-xl overflow-hidden border border-emerald-500/20 h-24 bg-slate-950">
                                <img 
                                  src={activeIssue.after_image_urls?.[0] || ''} 
                                  alt="After" 
                                  className="w-full h-full object-cover" 
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 mt-3 text-[10px] bg-slate-900/40 p-2.5 rounded-xl border border-slate-850">
                            {activeIssue.resolver_officer_name && (
                              <div>
                                <span className="text-slate-500 font-bold">Officer:</span>{' '}
                                <span className="text-slate-300 font-semibold">{activeIssue.resolver_officer_name}</span>
                              </div>
                            )}
                            {activeIssue.estimated_cost !== undefined && (
                              <div>
                                <span className="text-slate-500 font-bold">Estimated Cost:</span>{' '}
                                <span className="text-slate-300 font-mono font-semibold">${activeIssue.estimated_cost}</span>
                              </div>
                            )}
                            {activeIssue.material_used && (
                              <div>
                                <span className="text-slate-500 font-bold">Material Used:</span>{' '}
                                <span className="text-slate-300 font-semibold">{activeIssue.material_used}</span>
                              </div>
                            )}
                            {activeIssue.completion_notes && (
                              <div>
                                <span className="text-slate-500 font-bold">Work Notes:</span>
                                <p className="text-slate-400 mt-0.5 leading-relaxed">{activeIssue.completion_notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Citizen Verification Checkbox */}
                          {currentUser.role === 'citizen' && (
                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={!!activeIssue.citizen_verified}
                                  onChange={(e) => handleVerifyResolution(activeIssue.id, e.target.checked)}
                                  className="h-4 w-4 bg-slate-950 border-slate-800 text-emerald-500 rounded focus:ring-0 focus:ring-offset-0"
                                />
                                <span className="text-[11px] font-bold text-white">
                                  Verify Resolution Completion
                                </span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}                      <div className="pt-4 border-t border-slate-800/60 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <div className="text-[10px] text-slate-500 font-bold">
                            Priority Factor: <span className="font-mono text-slate-300">{activeIssue.priorityScore}/100</span>
                          </div>
                          {currentUser.role === 'citizen' && (
                            <button
                              onClick={() => handleUpvoteIssue(activeIssue.id)}
                              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all"
                            >
                              Upvote ({activeIssue.upvotesCount})
                            </button>
                          )}
                        </div>
                        {currentUser.role !== 'citizen' && (
                          <button
                            onClick={() => setIsStatusModalOpen(true)}
                            className="w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg cursor-pointer text-center"
                          >
                            Update Lifecycle Status
                          </button>
                        )}
                      </div>

                      {/* Verification Panel */}
                      {currentUser.role === 'citizen' && (
                        <IssueVerificationPanel 
                          issueId={activeIssue.id} 
                          apiBaseUrl={API_BASE_URL} 
                          onActionSuccess={() => {
                            fetchIssues();
                            setRefreshTrigger((prev) => prev + 1);
                          }}
                        />
                      )}

                      {/* Lifecycle Timeline */}
                      <IssueLifecycleTimeline 
                        issueId={activeIssue.id}
                        apiBaseUrl={API_BASE_URL}
                        refreshTrigger={refreshTrigger}
                      />

                      {/* Comments/Discussion Section */}
                      <IssueCommentsSection 
                        issueId={activeIssue.id} 
                        apiBaseUrl={API_BASE_URL} 
                      />
                    </div>
                  </div>
                ) : (
                  // Default Selection prompt
                  <div className="flex flex-col items-center justify-center text-center h-full py-10 px-6 rounded-3xl bg-slate-900/20 border border-slate-800/60 backdrop-blur-sm space-y-4">
                    <div className="p-5 rounded-full bg-slate-950 border border-slate-800/80 text-emerald-400 animate-pulse">
                      <MapPin className="h-9 w-9" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        {currentUser.role === 'citizen' ? 'Select Location' : 'Select Ticket on Map'}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
                        {currentUser.role === 'citizen' 
                          ? 'Click anywhere on the map or type an address in the search box to drop a location pin.'
                          : 'Select any ticket marker on the map to review details, inspection logs, work progress, and update status.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Analytics Dashboard Section */}
            {currentUser.role === 'citizen' && (
              <DashboardWidgets 
                totalIssues={totalIssues}
                resolvedIssues={resolvedIssues}
                pendingIssues={pendingIssues}
                criticalIssues={criticalIssues}
                issues={filteredIssues}
              />
            )}
          </div>
        ) : (
          <div className="animate-fadeIn">
            {currentUser.role === 'citizen' && (
              <CitizenDashboard 
                issues={filteredIssues}
                currentUser={currentUser}
                onVerifyResolution={handleVerifyResolution}
                apiBaseUrl={API_BASE_URL}
              />
            )}
            {currentUser.role === 'department_officer' && (
              <DepartmentDashboard 
                issues={filteredIssues}
                currentUser={currentUser}
                apiBaseUrl={API_BASE_URL}
                onRefresh={fetchIssues}
              />
            )}
            {(currentUser.role === 'administrator' || currentUser.role === 'municipal_admin') && (
              <AdminDashboard 
                issues={filteredIssues}
                currentUser={currentUser}
                apiBaseUrl={API_BASE_URL}
                onRefresh={fetchIssues}
                onSelectOnMap={(issue) => {
                  setActiveIssue(issue);
                  setActiveTab('map');
                }}
              />
            )}
          </div>
        )}

        {/* Floating Conversational AI Assistant */}
        {currentUser && (
          <FloatingAssistant 
            apiBaseUrl={API_BASE_URL} 
            selectedLocation={selectedLocation}
            addressDetails={addressDetails}
            isReporting={isReporting}
            activeIssue={activeIssue}
            currentUser={currentUser}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/40 py-8 text-center text-xs text-slate-500 space-y-2.5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-extrabold text-slate-400">© 2026 CiviX</p>
            <p className="text-[10px] text-slate-500 mt-0.5">AI-Powered Smart Municipal Intelligence Platform</p>
          </div>
          <div className="text-center sm:text-right text-[10px] text-slate-500 font-mono">
            <span>Built by <strong className="text-slate-400 font-bold">$Pulind Gadhia</strong></span>
          </div>
        </div>
        <span className="hidden">Status: {backendStatus} ({responseTime}), Rep: {reputation}</span>
      </footer>

      {/* Toast Notifications Overlay */}
      <ToastNotifications />

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Update Status Popup Modal */}
      {activeIssue && (
        <UpdateStatusModal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          issueId={activeIssue.id}
          currentStatus={activeIssue.status}
          currentDepartment={activeIssue.department || ''}
          apiBaseUrl={API_BASE_URL}
          onSuccess={async () => {
            fetchIssues();
            // Fetch updated issue details to refresh state
            try {
              const res = await axios.get(`${API_BASE_URL}/api/v1/issues/${activeIssue.id}`);
              setActiveIssue(res.data);
            } catch (err) {
              console.error(err);
            }
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

export default App;
