/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserProfile } from '../../context/AuthContext';
import { X, User, Phone, MapPin, Image as ImageIcon, Loader2, LogOut, Shield } from 'lucide-react';
import { showToast } from '../../utils/toast';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { userProfile, updateProfile, logout } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  
  // Preferences
  const [emailNotify, setEmailNotify] = useState(true);
  const [pushNotify, setPushNotify] = useState(true);
  const [language, setLanguage] = useState<'en' | 'hi' | 'gu'>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && userProfile) {
      setFullName(userProfile.fullName || '');
      setPhone(userProfile.phone || '');
      setCity(userProfile.city || 'Ahmedabad');
      setEmailNotify(userProfile.notificationPreferences?.email !== false);
      setPushNotify(userProfile.notificationPreferences?.push !== false);
      setLanguage(userProfile.language || 'en');
      setTheme(userProfile.theme || 'dark');
      setPhotoFile(null);
      setPhotoPreview(userProfile.photoURL || null);
    }
  }, [isOpen, userProfile]);

  if (!isOpen || !userProfile) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedFields: Partial<UserProfile> = {
        fullName,
        phone,
        city,
        notificationPreferences: {
          email: emailNotify,
          push: pushNotify
        },
        language,
        theme
      };

      await updateProfile(updatedFields, photoFile);
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to log out?')) {
      onClose();
      await logout();
    }
  };

  // Get readable role label
  const getRoleLabel = () => {
    if (userProfile.role === 'citizen') return 'Citizen Profile';
    if (userProfile.role === 'department_officer') {
      const deptName = userProfile.department 
        ? userProfile.department.charAt(0).toUpperCase() + userProfile.department.slice(1) 
        : 'General';
      return `Officer - ${deptName} Department`;
    }
    if (userProfile.role === 'administrator' || userProfile.role === 'municipal_admin') {
      return 'Municipal Administrator';
    }
    return 'User';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Account Profile</h3>
            <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
              {userProfile.role}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Persona/Role Badge Card (Task 3: Glassmorphism Upgrades) */}
          <div className="p-5 bg-[#090e1f]/60 border border-slate-800/80 backdrop-blur-md rounded-2xl flex items-center gap-4 transition-all duration-300 hover:border-slate-700/80">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Active Credentials</p>
              <p className="text-xs font-extrabold text-slate-200">{getRoleLabel()}</p>
              <p className="text-[10px] font-mono text-slate-400/80 leading-none pt-0.5">{userProfile.email}</p>
            </div>
          </div>

          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative group">
              {photoPreview ? (
                <img src={photoPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-500">
                  <User className="h-6 w-6" />
                </div>
              )}
              <label className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-emerald-400 cursor-pointer transition-opacity">
                <ImageIcon className="h-4 w-4" />
                <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" className="hidden" />
              </label>
            </div>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Update Photo</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">City</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            {/* Notification Preferences */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notifications</label>
              <div className="flex flex-col sm:flex-row gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-355">
                  <input
                    type="checkbox"
                    checked={emailNotify}
                    onChange={(e) => setEmailNotify(e.target.checked)}
                    className="h-4 w-4 bg-slate-950 border-slate-800 text-emerald-500 rounded focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Email Notifications</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-355">
                  <input
                    type="checkbox"
                    checked={pushNotify}
                    onChange={(e) => setPushNotify(e.target.checked)}
                    className="h-4 w-4 bg-slate-950 border-slate-800 text-emerald-500 rounded focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Push Notifications</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-slate-800/60">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out Account</span>
            </button>
            <div className="flex-1 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 py-2.5 px-5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
