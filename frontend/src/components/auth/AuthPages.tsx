/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Cpu, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin, 
  Image as ImageIcon, 
  ShieldAlert, 
  ArrowRight, 
  Globe, 
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Users,
  Activity
} from 'lucide-react';
import { showToast } from '../../utils/toast';
import { auth } from '../../services/firebase';
import { Logo } from '../layout/Logo';
import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://civix-85vt.onrender.com";

// ----------------------------------------------------
// 1. Splash / Loading Screen
// ----------------------------------------------------
export const SplashPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center relative overflow-hidden select-none">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <Logo size="lg" />
        <div className="text-center">
          <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest mt-1">
            Loading Secure Workspace...
          </p>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// Helper mock alert component
// ----------------------------------------------------
const MockModeAlert: React.FC = () => {
  const { isFirebaseMode } = useAuth();
  if (isFirebaseMode) return null;

  return (
    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-2.5 items-start mb-4">
      <AlertCircle className="h-4.5 w-4.5 text-amber-400 shrink-0 mt-0.5" />
      <div className="text-[10px] text-amber-300 leading-normal">
        <p className="font-bold uppercase">Running in Mock Fallback Mode</p>
        <p className="opacity-90">Firebase environment variables are not configured. Any login/password will succeed. Use: <code className="bg-slate-950 px-1 py-0.5 rounded font-mono">officer@hero.com</code> or <code className="bg-slate-950 px-1 py-0.5 rounded font-mono">admin@hero.com</code> to simulate roles.</p>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// Password Strength Utilities
// ----------------------------------------------------
const PASSWORD_RULES = [
  { label: '8+ characters', test: (pw: string) => pw.length >= 8 },
  { label: 'Uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'Number', test: (pw: string) => /[0-9]/.test(pw) },
  { label: 'Special character', test: (pw: string) => /[^A-Za-z0-9\s]/.test(pw) },
];

const getPasswordStrength = (pw: string): { score: number; label: string; color: string } => {
  if (!pw) return { score: 0, label: '', color: '' };
  const passed = PASSWORD_RULES.filter(r => r.test(pw)).length;
  if (passed <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
  if (passed <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  if (passed <= 3) return { score: 3, label: 'Good', color: 'bg-sky-500' };
  if (passed <= 4) return { score: 4, label: 'Strong', color: 'bg-emerald-400' };
  return { score: 5, label: 'Excellent', color: 'bg-emerald-400' };
};

const isPasswordValid = (pw: string): boolean => {
  return PASSWORD_RULES.every(r => r.test(pw));
};

const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const ruleResults = useMemo(() => PASSWORD_RULES.map(r => ({ ...r, passed: r.test(password) })), [password]);

  if (!password) return null;

  return (
    <div className="space-y-2 p-3 bg-slate-950 border border-slate-850 rounded-xl">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Password Strength</span>
        <span className={`text-[9px] font-extrabold uppercase tracking-wider ${
          strength.score <= 1 ? 'text-rose-400' : strength.score <= 2 ? 'text-amber-400' : strength.score <= 3 ? 'text-sky-400' : 'text-emerald-400'
        }`}>{strength.label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i <= strength.score ? strength.color : 'bg-slate-800'
          }`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {ruleResults.map((r, i) => (
          <span key={i} className={`text-[9px] font-semibold ${
            r.passed ? 'text-emerald-400' : 'text-slate-600'
          }`}>
            {r.passed ? '✓' : '○'} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Firebase Auth Error Mapping
const getFirebaseErrorMessage = (error: any): string => {
  const code = error?.code || '';
  const map: Record<string, string> = {
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-not-found': 'No account found with this email address.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Contact the administrator.',
    'auth/too-many-requests': 'Too many failed attempts. Please wait a moment before trying again.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password is too weak. Please use a stronger password.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/requires-recent-login': 'Please sign in again to complete this action.',
  };
  return map[code] || error?.message || 'Authentication failed. Please try again.';
};

// ----------------------------------------------------
// 2. Landing Page
// ----------------------------------------------------
export const LandingPage: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  // Redirect logged-in user
  React.useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'citizen') navigate('/citizen');
      else if (userProfile.role === 'department_officer') navigate('/officer');
      else if (userProfile.role === 'administrator' || userProfile.role === 'municipal_admin') navigate('/admin');
      else navigate('/unauthorized');
    }
  }, [userProfile, navigate]);

  // Live platform statistics
  const [stats, setStats] = useState({
    total_citizens: 12,
    total_reports: 42,
    total_resolved: 24,
    total_departments: 4,
    total_officers: 6,
    ai_accuracy: 98.6,
    resolution_time_days: 1.4,
    participation_rate: 87.0
  });

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/analytics/public-stats`);
        if (active && res.data && res.data.success) {
          setStats(res.data);
        }
      } catch (err) {
        console.error('Failed to load live statistics, using defaults:', err);
      }
    };
    fetchStats();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#02050f] text-slate-100 font-sans relative overflow-hidden flex flex-col justify-between">
      {/* Dynamic Digital Mesh Grid (from Reference) */}
      <div className="absolute inset-0 digital-grid pointer-events-none z-0 opacity-40" />
      
      {/* Deep Cyber Radial Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[120px] animate-pulseGlow pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-650/10 rounded-full blur-[100px] animate-pulseGlow pointer-events-none" />

      {/* Atmospheric Night City Skyline Backdrop (Module 2) */}
      <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none z-0 opacity-[0.08] select-none overflow-hidden">
        <svg viewBox="0 0 1200 120" className="w-full h-full fill-current text-teal-400 object-cover" preserveAspectRatio="none">
          <path d="M0,120 L0,90 L20,90 L20,110 L45,110 L45,75 L70,75 L70,95 L95,95 L95,120 L150,120 L150,60 L185,60 L185,90 L210,90 L210,120 L270,120 L270,40 L310,40 L310,80 L345,80 L345,120 L400,120 L400,85 L430,85 L430,120 L510,120 L510,50 L560,50 L560,110 L590,110 L590,120 L680,120 L680,30 L730,30 L730,90 L765,90 L765,120 L840,120 L840,70 L890,70 L890,120 L960,120 L960,45 L1010,45 L1010,80 L1045,80 L1045,120 L1120,120 L1120,60 L1170,60 L1170,100 L1200,100 L1200,120 Z" />
        </svg>
      </div>
      <header className="sticky top-0 z-40 w-full border-b border-slate-900/50 bg-[#02050f]/80 backdrop-blur-md relative">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <Logo size="navbar" />
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-xs font-bold text-slate-350 hover:text-white transition-all">
              Sign in
            </Link>
            <Link 
              to="/register" 
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-md hover:shadow-teal-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Body */}
      <main className="max-w-7xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center items-center text-center space-y-10 z-10 w-full">
        

        {/* Hero Title & Subtitle Copy */}
        <div className="space-y-4.5 max-w-3xl animate-fadeIn">
          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white leading-none font-sans select-none">
            CiviX
          </h1>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-teal-400">
            AI-Powered Smart Municipal Intelligence Platform
          </p>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed pt-1">
            Empowering citizens and municipalities through AI-driven infrastructure monitoring, intelligent issue resolution, and real-time civic collaboration.
          </p>
        </div>

        {/* Access Command Center CTA Pill */}
        <div className="flex justify-center w-full z-10 pt-2">
          <Link 
            to="/login" 
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-xs font-black bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all shadow-xl shadow-teal-500/15 hover:shadow-teal-500/30 hover:scale-105 active:scale-100 cursor-pointer"
          >
            Access Command Center <ArrowRight className="h-4.5 w-4.5" />
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full pt-16 scroll-mt-20">
          
          {/* Card 1: AI Infrastructure Monitoring */}
          <div className="p-6 rounded-3xl bg-[#090e1f]/60 border border-slate-800/80 backdrop-blur-md text-left space-y-4 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/5 group relative overflow-hidden">
            <div className="absolute inset-0 digital-grid pointer-events-none opacity-10" />
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
                <Cpu className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Infrastructure Monitoring</h3>
            </div>
            
            <div className="space-y-3 pt-2 relative z-10">
              <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                <span className="text-slate-400">Roads Monitored</span>
                <span className="font-bold text-white font-mono">24,520 km</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                <span className="text-slate-400">Water Pipelines</span>
                <span className="font-bold text-white font-mono">12,850 km</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Smart Inspections</span>
                <span className="font-bold text-emerald-450 font-mono">{stats.ai_accuracy}% Accuracy</span>
              </div>
            </div>
          </div>
          
          {/* Card 2: Community Collaboration */}
          <div className="p-6 rounded-3xl bg-[#090e1f]/60 border border-slate-800/80 backdrop-blur-md text-left space-y-4 hover:border-teal-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-teal-500/5 group relative overflow-hidden">
            <div className="absolute inset-0 digital-grid pointer-events-none opacity-10" />
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 shadow-inner group-hover:bg-teal-500 group-hover:text-slate-950 transition-all duration-300">
                <Users className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Community Collaboration</h3>
            </div>
            
            <div className="space-y-3 pt-2 relative z-10">
              <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                <span className="text-slate-400">Total Citizens</span>
                <span className="font-bold text-white font-mono">{stats.total_citizens} Registered</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                <span className="text-slate-400">Citizen Participation</span>
                <span className="font-bold text-white font-mono">{stats.participation_rate}% Active</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Resolution Accuracy</span>
                <span className="font-bold text-teal-400 font-mono">94.8% Score</span>
              </div>
            </div>
          </div>
          
          {/* Card 3: Municipal Operations */}
          <div className="p-6 rounded-3xl bg-[#090e1f]/60 border border-slate-800/80 backdrop-blur-md text-left space-y-4 hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/5 group relative overflow-hidden">
            <div className="absolute inset-0 digital-grid pointer-events-none opacity-10" />
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20 shadow-inner group-hover:bg-violet-500 group-hover:text-slate-950 transition-all duration-300">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Municipal Operations</h3>
            </div>
            
            <div className="space-y-3 pt-2 relative z-10">
              <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                <span className="text-slate-400">Issues Resolved</span>
                <span className="font-bold text-white font-mono">{stats.total_resolved} Resolved</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                <span className="text-slate-400">Active Departments</span>
                <span className="font-bold text-white font-mono">{stats.total_departments} Units</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Officer Efficiency</span>
                <span className="font-bold text-violet-400 font-mono">1.4 Days Avg</span>
              </div>
            </div>
          </div>

        </div>

        {/* Storytelling Timeline Section (Module 6) */}
        <div className="w-full pt-20 pb-8 scroll-mt-20 relative z-10">
          <div className="text-center space-y-2 mb-14">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">Platform Operational Pipeline</h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">Visualizing the automated, end-to-end flow connecting citizens with municipal departments.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 relative max-w-5xl mx-auto">
            {/* Connecting lines on desktop */}
            <div className="hidden md:block absolute top-[28px] left-[8%] right-[8%] h-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 opacity-20 z-0" />
            
            {[
              { num: '01', title: 'Citizen Reports Issue', desc: 'Upload media, category recommendations & geolocations.', icon: MapPin, color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10' },
              { num: '02', title: 'AI Vision Analysis', desc: 'Google Gemini detects anomalies, confidence & severity.', icon: Cpu, color: 'text-teal-400 border-teal-500/20 bg-teal-500/5 hover:border-teal-500/40 hover:bg-teal-500/10' },
              { num: '03', title: 'Auto Assignment', desc: 'Automatic routing based on category mapping rules.', icon: Globe, color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40 hover:bg-cyan-500/10' },
              { num: '04', title: 'Officer Action', desc: 'Department team inspects and resolves the ticket.', icon: User, color: 'text-blue-400 border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 hover:bg-blue-500/10' },
              { num: '05', title: 'Issue Resolved', desc: 'Live dashboards notify and coordinate completion.', icon: Activity, color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/40 hover:bg-indigo-500/10' },
              { num: '06', title: 'Citizen Verification', desc: 'Peer-to-peer votes confirm and complete cycles.', icon: ShieldCheck, color: 'text-violet-400 border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40 hover:bg-violet-500/10' }
            ].map((step, idx) => (
              <div 
                key={idx} 
                className="relative z-10 flex flex-col items-center p-5 rounded-2xl bg-[#090e1f]/40 border border-slate-800/80 backdrop-blur-sm space-y-3 hover:border-slate-700 transition-all duration-300 hover:scale-[1.03] group"
              >
                <div className={`h-11 w-11 rounded-full border flex items-center justify-center font-bold text-xs shadow-inner transition-all duration-300 group-hover:scale-110 ${step.color}`}>
                  <step.icon className="h-4.5 w-4.5 animate-pulse" />
                </div>
                <div className="text-center space-y-1.5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{step.num} / Step</span>
                  <h4 className="text-xs font-bold text-white tracking-wide leading-tight">{step.title}</h4>
                  <p className="text-[10px] text-slate-500 leading-normal hidden sm:block pt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#02050f]/80 py-8 text-center text-xs text-slate-500 space-y-2.5 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-extrabold text-slate-400">© 2026 CiviX</p>
            <p className="text-[10px] text-slate-500 mt-0.5">AI-Powered Smart Municipal Intelligence Platform</p>
          </div>
          <div className="text-center sm:text-right text-[10px] text-slate-500 font-mono">
            <span>Built by <strong className="text-slate-400 font-bold">$Pulind Gadhia</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ----------------------------------------------------
// 3. Login Page
// ----------------------------------------------------
export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLoginAttempts(0);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil !== null && lockoutRemaining > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isLockedOut) return;
    setIsSubmitting(true);
    try {
      await login(email, password, rememberMe);
      setLoginAttempts(0);
      // Auth state listener in context handles redirect automatically
    } catch (err: any) {
      console.error(err);
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      const errorMsg = getFirebaseErrorMessage(err);
      
      if (newAttempts >= 5) {
        setLockoutUntil(Date.now() + 30000); // 30s cooldown
        setLockoutRemaining(30);
        showToast('Too many failed attempts. Please wait 30 seconds.', 'error');
      } else if (newAttempts >= 3) {
        showToast(`${errorMsg} (${5 - newAttempts} attempts remaining)`, 'error');
      } else {
        showToast(errorMsg, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      showToast(getFirebaseErrorMessage(err), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center justify-center">
            <Logo size="md" showText={false} />
          </Link>
          <h2 className="text-xl font-black text-white leading-tight">Welcome to CiviX</h2>
          <p className="text-xs text-slate-400">Log in to manage or report civic activities</p>
        </div>

        <MockModeAlert />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase text-slate-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@hero.org"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none placeholder-slate-600 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold uppercase text-slate-400">Password</label>
              <Link to="/forgot-password" className="text-[9px] font-semibold text-emerald-400 hover:underline">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none placeholder-slate-600 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 bg-slate-950 border-slate-850 text-emerald-500 rounded focus:ring-0 focus:ring-offset-0"
              />
              <span>Remember Me</span>
            </label>
          </div>

          {isLockedOut && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-2.5 items-center">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span className="text-[10px] text-rose-300 font-bold">
                Account temporarily locked. Try again in {lockoutRemaining}s
              </span>
            </div>
          )}

          {!isLockedOut && loginAttempts >= 3 && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-2 items-center">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-[9px] text-amber-300 font-semibold">
                {5 - loginAttempts} login attempts remaining before temporary lockout
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isLockedOut}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin text-slate-950" /> : isLockedOut ? `Locked (${lockoutRemaining}s)` : 'Sign In'}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Or Continue With</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 transition-colors cursor-pointer"
        >
          <Globe className="h-4 w-4 text-emerald-400" />
          <span>Google Accounts</span>
        </button>

        <div className="text-center text-xs text-slate-405 pt-2">
          New to the neighborhood?{' '}
          <Link to="/register" className="font-bold text-emerald-400 hover:underline">
            Create an Account
          </Link>
        </div>

      </div>
    </div>
  );
};

// ----------------------------------------------------
// 4. Citizen Registration Page
// ----------------------------------------------------
export const RegisterPage: React.FC = () => {
  const { registerCitizen, registrationStatus } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [city, setCity] = useState('Ahmedabad');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const passwordMeetsRequirements = useMemo(() => isPasswordValid(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordMeetsRequirements) {
      showToast('Password does not meet minimum security requirements.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (!termsAccepted) {
      showToast('You must accept the Terms of Service.', 'warning');
      return;
    }

    console.log('[REGISTRATION DEBUG] FORM VALIDATION COMPLETE. Initiating registration...');
    setIsSubmitting(true);
    try {
      await registerCitizen({
        fullName,
        email,
        phone,
        password,
        city,
        photoFile
      });
      console.log('[REGISTRATION DEBUG] registerCitizen promise resolved. Redirecting to verify-email...');
      // Auth state listener handles redirecting verified users.
      // If Firebase Auth is used, they will be redirected to verify-email because email is not verified yet.
      navigate('/verify-email');
    } catch (err: any) {
      console.error('[REGISTRATION DEBUG] Registration exception caught in form submit:', err);
      showToast(err.message || 'Registration failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-10 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-1.5">
          <Link to="/" className="inline-flex items-center justify-center">
            <Logo size="md" showText={false} />
          </Link>
          <h2 className="text-xl font-black text-white leading-tight">Create Citizen Account</h2>
          <p className="text-xs text-slate-400">Join CiviX and contribute to municipal hygiene</p>
        </div>

        <MockModeAlert />

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-20 w-20 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative group">
              {photoPreview ? (
                <img src={photoPreview} alt="Avatar Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-500">
                  <User className="h-8 w-8" />
                </div>
              )}
              <label className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-emerald-400 cursor-pointer transition-opacity">
                <ImageIcon className="h-5 w-5" />
                <input type="file" onChange={handlePhotoChange} accept="image/*" className="hidden" />
              </label>
            </div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Upload Profile Image (Optional)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.doe@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400">City</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none cursor-pointer transition-all"
                >
                  <option value="Ahmedabad">Ahmedabad</option>
                  <option value="Gandhinagar">Gandhinagar</option>
                  <option value="Vadodara">Vadodara</option>
                  <option value="Surat">Surat</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Bangalore">Bangalore</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none transition-all"
                />
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="h-4 w-4 bg-slate-950 border-slate-850 text-emerald-500 rounded focus:ring-0 focus:ring-offset-0 mt-0.5"
              />
              <span className="text-[10px] font-semibold text-slate-400 leading-normal">
                I accept the <a href="#" className="text-emerald-450 hover:underline">Terms of Service</a> and authorize CiviX to record my location coordinates solely for civic reporting verification purposes.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !passwordMeetsRequirements}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                {registrationStatus === 'CREATING_AUTH_USER' && 'Creating Account...'}
                {registrationStatus === 'UPLOADING_PROFILE_IMAGE' && 'Uploading Photo...'}
                {registrationStatus === 'CREATING_FIRESTORE_PROFILE' && 'Saving Profile...'}
                {registrationStatus === 'SENDING_VERIFICATION_EMAIL' && 'Sending Verification...'}
                {registrationStatus === 'SUCCESS' && 'Redirecting...'}
                {registrationStatus === 'IDLE' && 'Registering...'}
                {registrationStatus === 'FAILED' && 'Failed'}
              </span>
            ) : !passwordMeetsRequirements && password ? (
              'Password Too Weak'
            ) : (
              'Complete Registration'
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-405">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-emerald-400 hover:underline">
            Sign In Instead
          </Link>
        </div>

      </div>
    </div>
  );
};

// ----------------------------------------------------
// 5. Forgot Password Page
// ----------------------------------------------------
export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      navigate('/login');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to trigger reset email.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-600 items-center justify-center shadow-lg shadow-emerald-500/20">
            <Cpu className="h-5 w-5 text-slate-950" />
          </Link>
          <h2 className="text-xl font-black text-white leading-tight">Recover Password</h2>
          <p className="text-xs text-slate-400">Request password reset link via registered email</p>
        </div>

        <MockModeAlert />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase text-slate-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@hero.org"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-emerald-500/50 rounded-xl text-xs text-white focus:outline-none placeholder-slate-650 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin text-slate-950" /> : 'Send Reset Link'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-405">
          Remember credentials?{' '}
          <Link to="/login" className="font-bold text-emerald-400 hover:underline">
            Back to Sign In
          </Link>
        </div>

      </div>
    </div>
  );
};

// ----------------------------------------------------
// 6. Email Verification Page
// ----------------------------------------------------
export const EmailVerificationPage: React.FC = () => {
  const { user, resendVerification, logout } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();

  const handleResend = async () => {
    setIsSending(true);
    try {
      await resendVerification();
    } catch (err: any) {
      showToast(err.message || 'Failed to resend.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleReload = async () => {
    if (auth && auth.currentUser) {
      try {
        await auth.currentUser.reload();
      } catch (err) {
        console.error('Failed to reload user:', err);
      }
    }
    // Reload page to re-trigger Auth state detection
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative z-10 text-center space-y-6">
        
        <div className="inline-flex h-12 w-12 rounded-full bg-emerald-500/10 items-center justify-center border border-emerald-500/20 text-emerald-400 animate-bounce">
          <Mail className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white leading-tight">Verify Your Email</h2>
          <p className="text-xs text-slate-400">
            We sent a verification link to <span className="font-semibold text-slate-200">{user?.email}</span>.
          </p>
          <p className="text-[10px] text-slate-500 leading-normal">
            Please click on the link in the email to verify and activate your Citizen profile. If you have verified, click below to refresh your status.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleReload}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg cursor-pointer"
          >
            I Have Verified (Refresh)
          </button>
          
          <button
            onClick={handleResend}
            disabled={isSending}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSending ? <RefreshCw className="h-4 w-4 animate-spin text-slate-300" /> : 'Resend Verification Email'}
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs font-bold text-slate-500 hover:text-slate-300 hover:underline"
        >
          Cancel and Sign Out
        </button>

      </div>
    </div>
  );
};

// ----------------------------------------------------
// 7. Unauthorized Access Screen
// ----------------------------------------------------
export const UnauthorizedPage: React.FC = () => {
  const { logout, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleReturn = () => {
    if (userProfile) {
      if (userProfile.role === 'citizen') navigate('/citizen');
      else if (userProfile.role === 'department_officer') navigate('/officer');
      else if (userProfile.role === 'administrator' || userProfile.role === 'municipal_admin') navigate('/admin');
      else navigate('/login');
    } else {
      navigate('/login');
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/40 border border-rose-900/30 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative z-10 text-center space-y-6">
        
        <div className="inline-flex h-12 w-12 rounded-full bg-rose-550/10 items-center justify-center border border-rose-500/30 text-rose-455">
          <ShieldAlert className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white leading-tight">Access Denied</h2>
          <p className="text-xs text-slate-400">
            You do not have permissions to access this municipal workspace.
          </p>
          <p className="text-[10px] text-slate-500 leading-normal">
            This module is restricted to authorized personnel. If you believe this is an error, please contact the municipal system administrator.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleReturn}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg cursor-pointer"
          >
            Return to Dashboard
          </button>
          
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-350 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
};

// ----------------------------------------------------
// 8. 404 Page Not Found
// ----------------------------------------------------
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative z-10 text-center space-y-6">
        
        <h1 className="text-6xl font-black text-emerald-400 tracking-tight leading-none animate-pulse">404</h1>

        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-white uppercase tracking-wider">Page Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The page you are looking for does not exist or has been relocated by the city council.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg cursor-pointer"
        >
          Return to Headquarters
        </button>

      </div>
    </div>
  );
};
