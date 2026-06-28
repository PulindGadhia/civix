import React, { useState } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import { IssueCommentsSection } from '../verification/IssueCommentsSection';
import { IssueLifecycleTimeline } from '../verification/IssueLifecycleTimeline';
import type { Issue } from '../../App';

interface CitizenDashboardProps {
  issues: Issue[];
  currentUser: { uid: string; role: string; name: string };
  onVerifyResolution: (issueId: string, verified: boolean, rating?: number, feedback?: string) => Promise<void>;
  apiBaseUrl: string;
}

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  issues,
  currentUser,
  onVerifyResolution,
  apiBaseUrl,
}) => {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');

  // Filter issues belonging to this citizen
  const myIssues = issues.filter(issue => issue.citizenId === currentUser.uid);
  const selectedIssue = issues.find(issue => issue.id === selectedIssueId);

  const handleIssueSelect = (id: string) => {
    setSelectedIssueId(id);
    setRating(0);
    setFeedback('');
  };

  const getStatusBadge = (status: string) => {
    const formatted = status.replace('_', ' ').toUpperCase();
    switch (status) {
      case 'resolved':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">{formatted}</span>;
      case 'closed':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-500/20 text-slate-400 rounded-full border border-slate-500/30">{formatted}</span>;
      case 'work_in_progress':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">{formatted}</span>;
      case 'reported':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">{formatted}</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">{formatted}</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-140px)]">
      {/* Left Column: My Reports List */}
      <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col space-y-4">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-400" />
            My Filed Reports
          </h2>
          <p className="text-[10px] text-slate-500">Track the progress of your submitted complaints</p>
        </div>

        {myIssues.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-xl">
            <AlertCircle className="h-8 w-8 text-slate-600" />
            <p className="text-xs font-semibold text-slate-400">No reports filed yet</p>
            <p className="text-[10px] text-slate-500 max-w-[200px]">Use the reporting map to report an infrastructure issue.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {myIssues.map(issue => (
              <button
                key={issue.id}
                onClick={() => handleIssueSelect(issue.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedIssueId === issue.id 
                    ? 'bg-slate-800/50 border-emerald-500/50 shadow-md shadow-emerald-500/5' 
                    : 'bg-slate-950/40 border-slate-800/50 hover:bg-slate-800/20'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-slate-500">#{issue.id.slice(-6)}</span>
                  {getStatusBadge(issue.status)}
                </div>
                <h3 className="text-xs font-bold text-white line-clamp-1">{issue.title}</h3>
                {issue.aiSummary && (
                  <p className="text-[9px] text-violet-400 italic line-clamp-2 mt-0.5 leading-relaxed">
                    🤖 {issue.aiSummary}
                  </p>
                )}
                {!issue.aiSummary && (
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-1">{issue.description}</p>
                )}
                <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-3">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  <span className="truncate">{issue.address.split(',')[0]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Track & Lifecycle View */}
      <div className="lg:col-span-8 space-y-6">
        {selectedIssue ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Issue Overview & Verification Section */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-5">
              <div>
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Incident Overview</span>
                <h2 className="text-base font-extrabold text-white mt-1">{selectedIssue.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(selectedIssue.status)}
                  <span className="text-[10px] font-mono text-slate-500">Category: {selectedIssue.category}</span>
                </div>
              </div>

              {selectedIssue.publicImageUrl && (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-800">
                  <img 
                    src={selectedIssue.publicImageUrl} 
                    alt={selectedIssue.title} 
                    className="object-cover w-full h-full"
                  />
                </div>
              )}

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/40 text-[11px] text-slate-300 leading-relaxed">
                {selectedIssue.description}
              </div>

              {selectedIssue.aiSummary && (
                <div className="p-3 bg-violet-950/20 border border-violet-700/30 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block">🤖 AI Executive Summary</span>
                  <p className="text-[11px] text-violet-200 leading-relaxed">{selectedIssue.aiSummary}</p>
                </div>
              )}

              {/* Citizen Verification Panel */}
              {(selectedIssue.status === 'resolved' || 
                selectedIssue.status === 'citizen_verification_pending' || 
                selectedIssue.status === 'repair_completed') && (
                <div className="p-5 rounded-xl bg-slate-950/60 border border-emerald-500/20 space-y-4 shadow-xl animate-fadeIn">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    Verify Resolution Feedback
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    This issue has been marked as repaired. Please review the completion details below and rate the resolution.
                  </p>
                  
                  {selectedIssue.completion_notes && (
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-[10px]">
                      <span className="text-slate-500 font-bold block">Officer Repair Notes:</span>
                      <p className="text-slate-300 mt-1">{selectedIssue.completion_notes}</p>
                    </div>
                  )}

                  {selectedIssue.after_image_urls && selectedIssue.after_image_urls.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Completion Photos</span>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedIssue.after_image_urls.map((url: string, index: number) => (
                          <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                            <img src={url} alt={`Evidence ${index + 1}`} className="object-cover w-full h-full" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Rate the Quality of Work</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="focus:outline-none transition-all duration-200 hover:scale-125 active:scale-95 cursor-pointer transform"
                        >
                          <svg
                            className={`h-6 w-6 transition-colors duration-200 ${
                              star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700 hover:text-amber-300'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.252.58 1.849l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.18 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118l-3.97-2.883c-.78-.597-.38-1.849.58-1.849h4.906a1 1 0 00.95-.69l1.519-4.674z"
                            />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Additional Feedback / Comments</span>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Share details about the repair..."
                      className="w-full text-[10.5px] bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500/80 min-h-[60px]"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => onVerifyResolution(selectedIssue.id, true, rating, feedback)}
                      disabled={rating === 0}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-slate-950 font-extrabold text-[9px] uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/5 cursor-pointer disabled:bg-slate-850 disabled:text-slate-500 disabled:scale-100"
                    >
                      Accept Resolution
                    </button>
                    <button
                      onClick={() => onVerifyResolution(selectedIssue.id, false, rating, feedback)}
                      className="flex-1 py-2.5 bg-rose-950/60 border border-rose-500/30 hover:bg-rose-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-rose-400 font-extrabold text-[9px] uppercase tracking-widest rounded-xl cursor-pointer"
                    >
                      Reject & Reopen
                    </button>
                  </div>
                </div>
              )}

              {/* Display Officer Details */}
              {selectedIssue.officer_name && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950/20 border border-slate-800/30 rounded-xl text-[10px]">
                  <div>
                    <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Assigned Officer</span>
                    <span className="text-slate-300 font-semibold">{selectedIssue.officer_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Municipal Sector</span>
                    <span className="text-slate-300 font-semibold capitalize">{selectedIssue.department || 'Unassigned'}</span>
                  </div>
                  {selectedIssue.technician_name && (
                    <div>
                      <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Lead Technician</span>
                      <span className="text-slate-300 font-semibold">{selectedIssue.technician_name}</span>
                    </div>
                  )}
                  {selectedIssue.inspection_date && (
                    <div>
                      <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Inspection Date</span>
                      <span className="text-slate-300 font-semibold">{selectedIssue.inspection_date}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timeline & Comments Panel */}
            <div className="flex flex-col space-y-6">
              
              {/* Lifecycle status history */}
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex-1">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  Status History
                </h3>
                <IssueLifecycleTimeline issueId={selectedIssue.id} apiBaseUrl={apiBaseUrl} />
              </div>

              {/* Citizen comments panel */}
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm max-h-[350px] overflow-hidden flex flex-col">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                  Comments & Feedback
                </h3>
                <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
                  <IssueCommentsSection 
                    issueId={selectedIssue.id} 
                    apiBaseUrl={apiBaseUrl} 
                  />
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/20 border border-slate-800/40 backdrop-blur-sm text-center text-slate-500">
            <ShieldAlert className="h-10 w-10 text-slate-700 mb-2" />
            <h3 className="text-sm font-bold text-slate-400">Select a report to track</h3>
            <p className="text-[10px] text-slate-500 max-w-[280px] mt-1">Select one of your filed incidents from the left column to view its live municipal resolution history.</p>
          </div>
        )}
      </div>
    </div>
  );
};
