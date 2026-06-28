import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import {
  MessageSquare,
  Pin,
  Edit2,
  CornerDownRight,
  Upload,
  Send,
  Loader2,
  FileImage,
  Video,
  Check,
  X
} from 'lucide-react';

interface Reply {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  message: string;
  createdAt: string;
}

interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  message: string;
  media_urls: string[];
  replies: Reply[];
  is_pinned: boolean;
  is_edited: boolean;
  createdAt: string;
}

interface IssueCommentsSectionProps {
  issueId: string;
  apiBaseUrl: string;
}

export function IssueCommentsSection({ issueId, apiBaseUrl }: IssueCommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Comment Form
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interaction states
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const currentUserId = 'mock-citizen-uid'; // Default mock citizen UID

  const loadComments = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/issues/${issueId}/comments`);
      setComments(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Could not load discussion board.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    let unsubscribe: (() => void) | undefined;

    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, 'issue_comments'),
          where('issue_id', '==', issueId)
        );
        unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedComments: Comment[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const commentData = { ...data } as any;
            if (commentData.createdAt && typeof commentData.createdAt.toDate === 'function') {
              commentData.createdAt = commentData.createdAt.toDate().toISOString();
            }
            if (commentData.replies) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              commentData.replies = commentData.replies.map((reply: any) => {
                const replyCopy = { ...reply };
                if (replyCopy.createdAt && typeof replyCopy.createdAt.toDate === 'function') {
                  replyCopy.createdAt = replyCopy.createdAt.toDate().toISOString();
                }
                return replyCopy;
              });
            }
            fetchedComments.push(commentData);
          });
          // Sort comments: pinned comments first, then chronological
          fetchedComments.sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          setComments(fetchedComments);
          setIsLoading(false);
          setError(null);
        }, (err) => {
          console.error('Firestore comments subscription error:', err);
          loadComments();
        });
      } catch (err) {
        console.error('Failed to setup comments listener:', err);
        loadComments();
      }
    } else {
      loadComments();
    }

    return () => {
      if (unsubscribe) unsubscribe();
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

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && selectedFiles.length === 0) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('message', message);
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      await axios.post(`${apiBaseUrl}/api/v1/issues/${issueId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadComments();
    } catch (err) {
      console.error('Error posting comment:', err);
      setError('Failed to post comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostReply = async (commentId: string) => {
    if (!replyMessage.trim()) return;

    setIsReplying(true);
    try {
      await axios.post(
        `${apiBaseUrl}/api/v1/issues/${issueId}/comments/${commentId}/reply`,
        { message: replyMessage }
      );
      setReplyMessage('');
      setReplyToId(null);
      await loadComments();
    } catch (err) {
      console.error('Error posting reply:', err);
      setError('Failed to submit reply.');
    } finally {
      setIsReplying(false);
    }
  };

  const handleTogglePin = async (commentId: string, currentPinned: boolean) => {
    try {
      await axios.post(
        `${apiBaseUrl}/api/v1/issues/${issueId}/comments/${commentId}/pin`,
        { is_pinned: !currentPinned }
      );
      await loadComments();
    } catch (err) {
      console.error('Error toggling pin status:', err);
      setError('Only municipal officials can pin comments.');
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditMessage(comment.message);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editMessage.trim()) return;

    setIsSavingEdit(true);
    try {
      await axios.put(
        `${apiBaseUrl}/api/v1/issues/${issueId}/comments/${commentId}`,
        { message: editMessage }
      );
      setEditingId(null);
      setEditMessage('');
      await loadComments();
    } catch (err) {
      console.error('Error editing comment:', err);
      setError('Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading && comments.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
        <span className="ml-2.5 text-xs text-slate-400">Loading comments...</span>
      </div>
    );
  }

  return (
    <div className="pt-5 border-t border-slate-800/80 space-y-5 text-slate-200">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-emerald-400" />
          Comments & Timeline
        </h4>
        <span className="text-[10px] text-slate-500 font-mono">{comments.length} Comments</span>
      </div>

      {/* Main Comment Posting Form */}
      <form onSubmit={handlePostComment} className="space-y-2.5">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask a question or add details on this issue..."
          className="w-full text-[11px] bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 min-h-[50px]"
        />

        <div className="flex items-center justify-between">
          {/* File select for comments */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
            >
              <Upload className="h-3 w-3" />
              Attach Proof
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              multiple
              className="hidden"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || (!message.trim() && selectedFiles.length === 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-505 bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Send className="h-3 w-3" />
                Comment
              </>
            )}
          </button>
        </div>

        {/* Selected files listing */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-slate-950 border border-slate-800 rounded-md text-[8px] font-mono">
                <span className="text-slate-400 truncate max-w-[100px]">{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)} className="text-rose-400 font-bold ml-1">×</button>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Errors */}
      {error && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-slate-500 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-[10px] text-slate-500 text-center italic py-2">
            No comments yet. Start the conversation!
          </p>
        ) : (
          comments.map((comment) => (
            <div 
              key={comment.id} 
              className={`p-3.5 rounded-2xl border transition-all ${
                comment.is_pinned 
                  ? 'bg-emerald-500/[0.02] border-emerald-500/30' 
                  : 'bg-slate-900/40 border-slate-800/80'
              }`}
            >
              
              {/* Comment Header */}
              <div className="flex justify-between items-start mb-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-white">{comment.author_name}</span>
                  <span className="px-1.5 py-0.1 bg-slate-850 border border-slate-800 text-[8px] text-slate-400 rounded">
                    {comment.author_role}
                  </span>
                  
                  {comment.is_pinned && (
                    <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      <Pin className="h-2 w-2 shrink-0 fill-current" />
                      Pinned Announcement
                    </span>
                  )}

                  {comment.is_edited && (
                    <span className="text-[8px] text-slate-500 italic">(edited)</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Pin button toggle */}
                  <button
                    onClick={() => handleTogglePin(comment.id, comment.is_pinned)}
                    title={comment.is_pinned ? 'Unpin comment' : 'Pin comment'}
                    className={`p-1 rounded hover:bg-slate-850 cursor-pointer ${
                      comment.is_pinned ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                  
                  {/* Edit button */}
                  {comment.author_id === currentUserId && (
                    <button
                      onClick={() => handleStartEdit(comment)}
                      title="Edit comment"
                      className="p-1 rounded hover:bg-slate-850 text-slate-500 hover:text-slate-330 cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  )}
                  
                  <span className="text-[8px] text-slate-500 font-mono ml-1.5">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Comment Message / Edit Form */}
              {editingId === comment.id ? (
                <div className="space-y-2 mt-1">
                  <textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="w-full text-[11px] bg-slate-950 border border-slate-800 rounded-xl p-2 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleSaveEdit(comment.id)}
                      disabled={isSavingEdit}
                      className="p-1 bg-emerald-500 text-slate-950 hover:bg-emerald-450 rounded cursor-pointer"
                    >
                      {isSavingEdit ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-300 leading-normal font-medium">{comment.message}</p>
              )}

              {/* Media Attachments */}
              {comment.media_urls && comment.media_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {comment.media_urls.map((url, i) => {
                    const isVideo = url.endsWith('.mp4') || url.includes('/video/');
                    return (
                      <div key={i} className="h-14 w-20 rounded-lg overflow-hidden border border-slate-950 bg-slate-950 relative group">
                        {isVideo ? (
                          <video src={url} className="w-full h-full object-cover" preload="metadata" />
                        ) : (
                          <img src={url} alt="Comment Attachment" className="w-full h-full object-cover" />
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

              {/* Replies Sub-thread */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3.5 pt-2.5 border-t border-slate-800/50 space-y-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2 text-[10px] pl-2">
                      <CornerDownRight className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 leading-normal flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">{reply.author_name}</span>
                          <span className="px-1 py-0.1 bg-slate-900 border border-slate-800 text-[7px] text-slate-500 rounded">
                            {reply.author_role}
                          </span>
                          <span className="text-[7px] text-slate-500 font-mono ml-auto">
                            {new Date(reply.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-400 font-medium">{reply.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply trigger / input */}
              <div className="mt-2.5 pt-1.5 border-t border-slate-850 flex items-center justify-between">
                <button
                  onClick={() => {
                    setReplyToId(replyToId === comment.id ? null : comment.id);
                    setReplyMessage('');
                  }}
                  className="text-[9px] text-slate-500 hover:text-slate-300 font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <CornerDownRight className="h-3 w-3" />
                  Reply to thread
                </button>
              </div>

              {replyToId === comment.id && (
                <div className="flex gap-2 mt-2 pl-3 animate-fadeIn">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 bg-slate-950 border border-slate-850 rounded-lg p-2 text-[10px] text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => handlePostReply(comment.id)}
                    disabled={isReplying || !replyMessage.trim()}
                    className="px-3 bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 rounded-lg text-[10px] transition-colors cursor-pointer"
                  >
                    {isReplying ? '...' : 'Reply'}
                  </button>
                </div>
              )}

            </div>
          ))
        )}
      </div>

    </div>
  );
}
