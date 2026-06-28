import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import {
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Upload,
  Sparkles,
  Shield,
  ShieldAlert,
  Loader2,
  FileImage,
  Video
} from 'lucide-react';

interface Verification {
  id: string;
  user_name: string;
  user_role: string;
  user_trust_score: number;
  action: string;
  description: string;
  media_urls: string[];
  createdAt: string;
}

interface VerificationStats {
  confidence_score: number;
  verification_count: number;
  dispute_count: number;
  verifications: Verification[];
}

interface IssueVerificationPanelProps {
  issueId: string;
  apiBaseUrl: string;
  onActionSuccess?: () => void;
}

export function IssueVerificationPanel({ issueId, apiBaseUrl, onActionSuccess }: IssueVerificationPanelProps) {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verification Form State
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVerificationData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/issues/${issueId}/verifications`);
      setStats(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching verifications:', err);
      setError('Failed to load community verification data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    let unsubIssue: (() => void) | undefined;
    let unsubVerifs: (() => void) | undefined;

    if (isFirebaseConfigured && db) {
      try {
        const issueRef = doc(db, 'issues', issueId);
        unsubIssue = onSnapshot(issueRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setStats((prev) => {
              const base = prev || { confidence_score: 90, verification_count: 0, dispute_count: 0, verifications: [] };
              return {
                ...base,
                confidence_score: data.confidenceScore ?? data.confidence_score ?? 90,
                verification_count: data.verificationCount ?? data.verification_count ?? 0,
                dispute_count: data.disputeCount ?? data.dispute_count ?? 0,
              };
            });
            setIsLoading(false);
            setError(null);
          }
        }, (err) => {
          console.error('Firestore issue verification stats snapshot error:', err);
        });

        const qVerifs = query(collection(db, 'issue_verifications'), where('issue_id', '==', issueId));
        unsubVerifs = onSnapshot(qVerifs, (snapshot) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const verif = { ...item } as any;
            if (verif.createdAt && typeof verif.createdAt.toDate === 'function') {
              verif.createdAt = verif.createdAt.toDate().toISOString();
            }
            // Map keys to frontend expectation (v.user_badge and v.user_trust_score)
            verif.user_badge = verif.user_role || 'Citizen';
            verif.user_trust_score = verif.user_trust_score || 100;
            list.push(verif);
          });
          // Sort by date descending
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setStats((prev) => {
            const base = prev || { confidence_score: 90, verification_count: 0, dispute_count: 0, verifications: [] };
            return {
              ...base,
              verifications: list
            };
          });
        }, (err) => {
          console.error('Firestore issue verifications list snapshot error:', err);
        });
      } catch (err) {
        console.error('Failed to setup verification listener:', err);
        loadVerificationData();
      }
    } else {
      loadVerificationData();
    }

    return () => {
      if (unsubIssue) unsubIssue();
      if (unsubVerifs) unsubVerifs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArr]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleActionClick = (action: string) => {
    setSelectedAction(action === selectedAction ? null : action);
    setSubmitMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) return;

    setIsSubmitting(true);
    setSubmitMessage(null);

    const formData = new FormData();
    formData.append('action', selectedAction);
    formData.append('description', description);
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(
        `${apiBaseUrl}/api/v1/issues/${issueId}/verify`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setSubmitMessage('Thank you! Your verification has been submitted.');
        setDescription('');
        setSelectedFiles([]);
        setSelectedAction(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        await loadVerificationData();
        if (onActionSuccess) {
          onActionSuccess();
        }
      }
    } catch (err) {
      console.error('Error submitting verification:', err);
      setError('Failed to submit verification action. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
        <span className="ml-2.5 text-xs text-slate-400">Loading verification details...</span>
      </div>
    );
  }

  // Get action styling
  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case 'verify':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'resolved':
        return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
      case 'incorrect_info':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      case 'duplicate':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'verify':
        return 'Verified Issue';
      case 'resolved':
        return 'Marked Resolved';
      case 'incorrect_info':
        return 'Disputed Info';
      case 'duplicate':
        return 'Flagged Duplicate';
      case 'evidence':
        return 'Added Evidence';
      default:
        return action;
    }
  };

  const getTrustBadgeStyle = (badge: string) => {
    switch (badge.toLowerCase()) {
      case 'top reporter':
        return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black border border-yellow-400/25';
      case 'trusted citizen':
        return 'bg-violet-600/20 border border-violet-500/30 text-violet-300 font-extrabold';
      case 'community volunteer':
        return 'bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold';
      case 'verified contributor':
        return 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-semibold';
      default:
        return 'bg-slate-800 border border-slate-700/60 text-slate-400';
    }
  };

  const confidenceScore = stats?.confidence_score ?? 90;
  const verificationsCount = stats?.verification_count ?? 0;
  const disputesCount = stats?.dispute_count ?? 0;
  const verifications = stats?.verifications ?? [];

  // Determine confidence color
  let confidenceColor = 'from-emerald-500 to-teal-500 text-emerald-400';
  let confidenceBg = 'bg-emerald-500/10 border border-emerald-500/20';
  if (confidenceScore < 40) {
    confidenceColor = 'from-rose-500 to-red-600 text-rose-400';
    confidenceBg = 'bg-rose-500/10 border border-rose-500/20';
  } else if (confidenceScore < 70) {
    confidenceColor = 'from-amber-500 to-orange-500 text-amber-400';
    confidenceBg = 'bg-amber-500/10 border border-amber-500/20';
  }

  return (
    <div className="pt-5 border-t border-slate-800/80 space-y-5 text-slate-200">
      
      {/* Community Verification Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-emerald-400" />
          Community Verification
        </h4>
        <span className="text-[10px] text-slate-500">Phase 1 Lifecycle</span>
      </div>

      {/* Confidence Indicator Widget */}
      <div className={`p-4 rounded-2xl border ${confidenceBg} space-y-3`}>
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confidence Score</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xl font-extrabold tracking-tight bg-gradient-to-r ${confidenceColor} bg-clip-text text-transparent`}>
                {confidenceScore}%
              </span>
              <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1.5 justify-end text-[10px] font-extrabold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{verificationsCount} {verificationsCount === 1 ? 'Citizen' : 'Citizens'} Verified</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end text-[10px] font-bold text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{disputesCount} Disagreed</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950/80 h-2 rounded-full overflow-hidden border border-slate-800">
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${confidenceColor.replace('text-emerald-400', '').replace('text-rose-400', '').replace('text-amber-400', '')}`} 
            style={{ width: `${confidenceScore}%` }}
          />
        </div>
      </div>

      {/* Form Error Message */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-450 rounded-xl text-[11px] font-semibold">
          {error}
        </div>
      )}

      {/* Form Submission Message */}
      {submitMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[11px] font-semibold">
          {submitMessage}
        </div>
      )}

      {/* Verification Actions Selectors */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submit Verification Vote</span>
        <div className="grid grid-cols-2 gap-2">
          
          <button
            type="button"
            onClick={() => handleActionClick('verify')}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedAction === 'verify'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <ThumbsUp className="h-4 w-4 shrink-0" />
            <div className="text-[10px] leading-tight">
              <p className="font-bold">Verify Issue</p>
              <p className="text-[8px] text-slate-400 font-medium">Valid complaint</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleActionClick('resolved')}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedAction === 'resolved'
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div className="text-[10px] leading-tight">
              <p className="font-bold">Mark Resolved</p>
              <p className="text-[8px] text-slate-400 font-medium">Fixed on-site</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleActionClick('incorrect_info')}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedAction === 'incorrect_info'
                ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <ThumbsDown className="h-4 w-4 shrink-0" />
            <div className="text-[10px] leading-tight">
              <p className="font-bold">Dispute Info</p>
              <p className="text-[8px] text-slate-400 font-medium">Spam or error</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleActionClick('duplicate')}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedAction === 'duplicate'
                ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div className="text-[10px] leading-tight">
              <p className="font-bold">Duplicate</p>
              <p className="text-[8px] text-slate-400 font-medium">Already reported</p>
            </div>
          </button>

        </div>
      </div>

      {/* Sub-form for entering description and uploading files */}
      {selectedAction && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3.5 animate-fadeIn">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              Evidence Details
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold border ${getActionBadgeStyle(selectedAction)}`}>
                {selectedAction.toUpperCase()}
              </span>
            </span>
            <button 
              type="button" 
              onClick={() => setSelectedAction(null)}
              className="text-[9px] text-slate-500 hover:text-slate-300 font-bold"
            >
              Cancel
            </button>
          </div>

          {/* Description input */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add evidence notes, details or notes regarding duplicates or resolution..."
            className="w-full text-[11px] bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 min-h-[60px]"
            required={selectedAction === 'incorrect_info' || selectedAction === 'duplicate'}
          />

          {/* File selector input */}
          <div className="space-y-2">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Upload Proof (Images/Videos)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                Select Media
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                className="hidden"
              />
              <span className="text-[9px] text-slate-500">Supports JPG, PNG, MP4</span>
            </div>

            {/* Chosen files listing */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[9px]">
                    <span className="text-slate-400 truncate max-w-[120px] font-mono">{file.name}</span>
                    <button 
                      type="button" 
                      onClick={() => removeFile(idx)} 
                      className="text-rose-450 hover:text-rose-300 font-black cursor-pointer ml-1 text-[11px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-extrabold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading Evidence...
              </>
            ) : (
              'Submit Verification Vote'
            )}
          </button>
        </form>
      )}

      {/* Community Activity Timeline Feed */}
      <div className="space-y-3.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recent Community Activity</span>
        
        {verifications.length === 0 ? (
          <p className="text-[10px] text-slate-500 text-center italic py-2">
            No verification actions have been logged yet. Be the first to verify!
          </p>
        ) : (
          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800/80">
            {verifications.map((v) => (
              <div key={v.id} className="flex gap-4 relative">
                
                {/* Status Dot */}
                <div className={`h-6.5 w-6.5 rounded-full border bg-slate-950 flex items-center justify-center shrink-0 z-10 ${
                  v.action === 'incorrect_info' ? 'border-rose-500/40 text-rose-505' :
                  v.action === 'duplicate' ? 'border-amber-500/40 text-amber-500' :
                  v.action === 'resolved' ? 'border-indigo-500/40 text-indigo-500' :
                  'border-emerald-500/40 text-emerald-500'
                }`}>
                  {v.action === 'incorrect_info' ? <ShieldAlert className="h-3 w-3" /> :
                   v.action === 'duplicate' ? <AlertTriangle className="h-3 w-3" /> :
                   <CheckCircle2 className="h-3 w-3" />}
                </div>

                {/* Event text */}
                <div className="space-y-1 text-[11px] leading-relaxed flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-extrabold text-white">{v.user_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] border font-bold ${getTrustBadgeStyle(v.user_role)}`}>
                      {v.user_role}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[7px] border font-semibold ${getActionBadgeStyle(v.action)}`}>
                      {getActionLabel(v.action)}
                    </span>
                    <span className="text-[8px] text-slate-500 ml-auto font-mono">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {v.description && (
                    <p className="text-[10px] text-slate-400 font-medium leading-normal bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/50 mt-1">
                      {v.description}
                    </p>
                  )}

                  {/* Evidence media attachments */}
                  {v.media_urls && v.media_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1.5">
                      {v.media_urls.map((url, i) => {
                        const isVideo = url.endsWith('.mp4') || url.includes('/video/');
                        return (
                          <div key={i} className="h-14 w-20 rounded-lg overflow-hidden border border-slate-900 bg-slate-950 relative group">
                            {isVideo ? (
                              <video src={url} className="w-full h-full object-cover" preload="metadata" />
                            ) : (
                              <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                            )}
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-bold text-white uppercase"
                            >
                              {isVideo ? <Video className="h-3 w-3 text-white" /> : <FileImage className="h-3 w-3 text-white" />}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
