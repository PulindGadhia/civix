import { useState, useEffect } from 'react';
import axios from 'axios';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import {
  Clock,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Activity,
  User,
  Search,
  Loader2,
  FileImage,
  Video
} from 'lucide-react';

interface ReplyItem {
  id: string;
  author_name: string;
  message: string;
  createdAt: string;
}

interface HistoryItem {
  id?: string;
  status: string;
  timestamp: string;
  notes?: string;
  updated_by: string;
  department?: string;
  progress_percentage?: number;
  media_urls?: string[];
  estimated_completion_date?: string;
  estimated_cost?: number;
}

interface VerificationItem {
  id?: string;
  action: string;
  createdAt: string;
  description?: string;
  user_name: string;
  user_role?: string;
  media_urls?: string[];
}

interface CommentItem {
  id?: string;
  createdAt: string;
  message?: string;
  author_name: string;
  author_role?: string;
  media_urls?: string[];
  replies?: ReplyItem[];
  is_pinned?: boolean;
  is_edited?: boolean;
}

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'verification' | 'comment';
  timestamp: string;
  title: string;
  notes: string;
  user_name: string;
  user_role?: string;
  department?: string;
  progress_percentage?: number;
  media_urls?: string[];
  estimated_completion_date?: string;
  estimated_cost?: number;
  replies?: ReplyItem[];
  is_pinned?: boolean;
  is_edited?: boolean;
}

interface IssueLifecycleTimelineProps {
  issueId: string;
  apiBaseUrl: string;
  refreshTrigger?: number;
}

export function IssueLifecycleTimeline({ issueId, apiBaseUrl, refreshTrigger }: IssueLifecycleTimelineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [verifsList, setVerifsList] = useState<VerificationItem[]>([]);
  const [commentsList, setCommentsList] = useState<CommentItem[]>([]);

  const fetchTimelineEvents = async () => {
    try {
      const [historyRes, verifsRes, commentsRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/api/v1/issues/${issueId}/lifecycle`),
        axios.get(`${apiBaseUrl}/api/v1/issues/${issueId}/verifications`),
        axios.get(`${apiBaseUrl}/api/v1/issues/${issueId}/comments`)
      ]);
      setHistoryList(historyRes.data || []);
      setVerifsList(verifsRes.data.verifications || []);
      setCommentsList(commentsRes.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching timeline:', err);
      setError('Could not load unified lifecycle timeline.');
    } finally {
      setIsLoading(false);
    }
  };

  // Compile timeline events dynamically on every render
  const historyEvents: TimelineEvent[] = historyList.map((h, index) => ({
    id: h.id || `hist-${index}`,
    type: 'status_change',
    timestamp: h.timestamp,
    title: `Status: ${h.status.replace(/_/g, ' ').toUpperCase()}`,
    notes: h.notes || '',
    user_name: h.updated_by,
    department: h.department,
    progress_percentage: h.progress_percentage,
    media_urls: h.media_urls || [],
    estimated_completion_date: h.estimated_completion_date,
    estimated_cost: h.estimated_cost
  }));

  const verifsEvents: TimelineEvent[] = verifsList.map((v, index) => ({
    id: v.id || `verif-${index}`,
    type: 'verification',
    timestamp: v.createdAt,
    title: `Citizen Action: ${v.action.replace(/_/g, ' ').toUpperCase()}`,
    notes: v.description || '',
    user_name: v.user_name,
    user_role: v.user_role,
    media_urls: v.media_urls || []
  }));

  const commentsEvents: TimelineEvent[] = commentsList.map((c, index) => ({
    id: c.id || `comment-${index}`,
    type: 'comment',
    timestamp: c.createdAt,
    title: `Discussion Comment`,
    notes: c.message || '',
    user_name: c.author_name,
    user_role: c.author_role,
    media_urls: c.media_urls || [],
    replies: c.replies || [],
    is_pinned: c.is_pinned,
    is_edited: c.is_edited
  }));

  const events = [...historyEvents, ...verifsEvents, ...commentsEvents];
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    let unsubHistory: (() => void) | undefined;
    let unsubVerifs: (() => void) | undefined;
    let unsubComments: (() => void) | undefined;

    if (isFirebaseConfigured && db) {
      try {
        const qHistory = query(collection(db, 'issue_status_history'), where('issue_id', '==', issueId));
        const qVerifs = query(collection(db, 'issue_verifications'), where('issue_id', '==', issueId));
        const qComments = query(collection(db, 'issue_comments'), where('issue_id', '==', issueId));

        unsubHistory = onSnapshot(qHistory, (snapshot) => {
          const list: HistoryItem[] = [];
          snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const h = { ...item } as any;
            if (h.timestamp && typeof h.timestamp.toDate === 'function') {
              h.timestamp = h.timestamp.toDate().toISOString();
            }
            list.push(h);
          });
          setHistoryList(list);
          setIsLoading(false);
        }, (err) => {
          console.error('Firestore timeline history snapshot error:', err);
        });

        unsubVerifs = onSnapshot(qVerifs, (snapshot) => {
          const list: VerificationItem[] = [];
          snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const v = { ...item } as any;
            if (v.createdAt && typeof v.createdAt.toDate === 'function') {
              v.createdAt = v.createdAt.toDate().toISOString();
            }
            list.push(v);
          });
          setVerifsList(list);
        }, (err) => {
          console.error('Firestore timeline verifs snapshot error:', err);
        });

        unsubComments = onSnapshot(qComments, (snapshot) => {
          const list: CommentItem[] = [];
          snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c = { ...item } as any;
            if (c.createdAt && typeof c.createdAt.toDate === 'function') {
              c.createdAt = c.createdAt.toDate().toISOString();
            }
            if (c.replies) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              c.replies = c.replies.map((reply: any) => {
                const rCopy = { ...reply };
                if (rCopy.createdAt && typeof rCopy.createdAt.toDate === 'function') {
                  rCopy.createdAt = rCopy.createdAt.toDate().toISOString();
                }
                return rCopy;
              });
            }
            list.push(c);
          });
          setCommentsList(list);
        }, (err) => {
          console.error('Firestore timeline comments snapshot error:', err);
        });
      } catch (err) {
        console.error('Failed to setup Firestore timeline listeners:', err);
        fetchTimelineEvents();
      }
    } else {
      fetchTimelineEvents();
      const interval = setInterval(fetchTimelineEvents, 8000);
      return () => clearInterval(interval);
    }

    return () => {
      if (unsubHistory) unsubHistory();
      if (unsubVerifs) unsubVerifs();
      if (unsubComments) unsubComments();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, refreshTrigger]);

  // Filter events based on search query
  const filteredEvents = events.filter((e) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      e.title.toLowerCase().includes(query) ||
      e.notes.toLowerCase().includes(query) ||
      e.user_name.toLowerCase().includes(query) ||
      (e.user_role && e.user_role.toLowerCase().includes(query)) ||
      (e.department && e.department.toLowerCase().includes(query)) ||
      (e.type && e.type.toLowerCase().includes(query))
    );
  });

  const getEventIcon = (type: TimelineEvent['type'], title: string) => {
    if (type === 'status_change') {
      if (title.includes('RESOLVED')) return <ShieldCheck className="h-4 w-4 text-emerald-400" />;
      if (title.includes('CLOSED')) return <ShieldCheck className="h-4 w-4 text-slate-400" />;
      return <Activity className="h-4 w-4 text-teal-400" />;
    }
    if (type === 'verification') {
      if (title.includes('INCORRECT') || title.includes('DISPUTE')) {
        return <ShieldAlert className="h-4 w-4 text-rose-500" />;
      }
      return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
    }
    return <MessageSquare className="h-4 w-4 text-indigo-400" />;
  };

  return (
    <div className="pt-5 border-t border-slate-800/80 space-y-4">
      
      {/* Timeline Header */}
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-emerald-400" />
          Lifecycle Timeline
        </h4>
        <span className="text-[9px] text-slate-500 font-mono">Unified Feed</span>
      </div>

      {/* Unified Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search timeline, status updates, comments..."
          className="w-full text-[11px] bg-slate-950 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
        />
        <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500" />
      </div>

      {isLoading && events.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
          <span className="ml-2 text-xs text-slate-500">Loading timeline...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-450 rounded-xl text-[11px] font-semibold">
          {error}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center text-[10px] text-slate-500 italic py-6">
          {searchQuery ? 'No matching logs found.' : 'No lifecycle events logged.'}
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800/80 pl-1 pr-0.5">
          {filteredEvents.map((e) => (
            <div key={e.id} className="flex gap-4 relative animate-fadeIn">
              
              {/* Event Dot Icon */}
              <div className="h-7 w-7 rounded-full border border-slate-800 bg-slate-950 flex items-center justify-center shrink-0 z-10">
                {getEventIcon(e.type, e.title)}
              </div>

              {/* Event Body Content */}
              <div className="flex-1 space-y-1.5 pb-2">
                
                {/* Meta details */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-extrabold text-white">{e.title}</span>
                  
                  {e.progress_percentage !== undefined && (
                    <span className="px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-mono font-bold">
                      {e.progress_percentage}%
                    </span>
                  )}
                  
                  {e.department && (
                    <span className="px-1.5 py-0.2 bg-teal-600/10 border border-teal-500/20 text-teal-400 rounded text-[9px] font-bold">
                      {e.department}
                    </span>
                  )}

                  <span className="text-[8px] text-slate-500 font-mono ml-auto">
                    {new Date(e.timestamp).toLocaleDateString()} {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Subtitle / User details */}
                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                  <User className="h-3 w-3 text-slate-500 shrink-0" />
                  <span>By: <strong className="text-slate-300">{e.user_name}</strong></span>
                  {e.user_role && (
                    <span className="px-1 py-0.2 bg-slate-950 border border-slate-800/80 text-slate-500 rounded ml-1 text-[8px]">
                      {e.user_role}
                    </span>
                  )}
                </div>

                {/* Note Details */}
                {e.notes && (
                  <div className="text-[10px] text-slate-400 leading-normal font-medium bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/50">
                    {e.notes}
                  </div>
                )}

                {/* Estimated attributes */}
                {(e.estimated_completion_date || e.estimated_cost) && (
                  <div className="flex gap-4 text-[9px] text-slate-400 font-bold bg-slate-950/20 p-2 rounded-lg border border-slate-900/30">
                    {e.estimated_completion_date && (
                      <span>Est. Completion: <strong className="text-slate-300">{e.estimated_completion_date}</strong></span>
                    )}
                    {e.estimated_cost !== undefined && (
                      <span>Est. Cost: <strong className="text-slate-300">${e.estimated_cost}</strong></span>
                    )}
                  </div>
                )}

                {/* Attachment Media */}
                {e.media_urls && e.media_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {e.media_urls.map((url, i) => {
                      const isVideo = url.endsWith('.mp4') || url.includes('/video/');
                      return (
                        <div key={i} className="h-14 w-20 rounded-lg overflow-hidden border border-slate-900 bg-slate-950 relative group">
                          {isVideo ? (
                            <video src={url} className="w-full h-full object-cover" preload="metadata" />
                          ) : (
                            <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                          )}
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-bold text-white uppercase"
                          >
                            {isVideo ? <Video className="h-3 w-3" /> : <FileImage className="h-3 w-3" />}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Replies for Comments */}
                {e.replies && e.replies.length > 0 && (
                  <div className="pl-3 border-l border-slate-800 space-y-2 mt-2 pt-1">
                    {e.replies.map((r: ReplyItem) => (
                      <div key={r.id} className="text-[9px] text-slate-400 leading-normal font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-250">{r.author_name}</span>
                          <span className="text-[7px] text-slate-500 font-mono">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-0.5">{r.message}</p>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
