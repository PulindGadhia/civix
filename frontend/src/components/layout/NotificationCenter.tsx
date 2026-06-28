/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Info, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type { Issue } from '../../App';

interface Notification {
  id: string;
  issue_id: string;
  message: string;
  status: string;
  timestamp: string;
  relativeTime?: string;
}

interface NotificationCenterProps {
  apiBaseUrl: string;
  currentUser: { uid: string; role: string; name: string; department?: string };
  issues: Issue[];
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  apiBaseUrl, 
  currentUser, 
  issues 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/notifications`);
      const now = Date.now();
      const mapped = response.data.map((notif: Notification) => {
        let relativeTime = '';
        try {
          const timestamp = new Date(notif.timestamp).getTime();
          const diffMs = now - timestamp;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);

          if (diffMins < 1) relativeTime = 'Just now';
          else if (diffMins < 60) relativeTime = `${diffMins}m ago`;
          else if (diffHours < 24) relativeTime = `${diffHours}h ago`;
          else relativeTime = `${diffDays}d ago`;
        } catch {
          // Keep empty string relativeTime
        }
        return { ...notif, relativeTime };
      });
      setNotifications(mapped);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, 'issue_notifications'),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        unsubscribe = onSnapshot(q, (snapshot) => {
          const list: Notification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const notif = { ...data } as any;
            if (notif.timestamp && typeof notif.timestamp.toDate === 'function') {
              notif.timestamp = notif.timestamp.toDate().toISOString();
            }
            list.push(notif);
          });

          const now = Date.now();
          const mapped = list.map((notif) => {
            let relativeTime = '';
            try {
              const timestamp = new Date(notif.timestamp).getTime();
              const diffMs = now - timestamp;
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMins / 60);
              const diffDays = Math.floor(diffHours / 24);

              if (diffMins < 1) relativeTime = 'Just now';
              else if (diffMins < 60) relativeTime = `${diffMins}m ago`;
              else if (diffHours < 24) relativeTime = `${diffHours}h ago`;
              else relativeTime = `${diffDays}d ago`;
            } catch {
              // Keep empty string relativeTime
            }
            return { ...notif, relativeTime };
          });
          setNotifications(mapped);
        }, (err) => {
          console.error('Firestore notifications snapshot error, falling back to polling:', err);
          fetchNotifications();
        });
      } catch (err) {
        console.error('Failed to setup Firestore notifications listener, falling back to polling:', err);
        fetchNotifications();
      }
    } else {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchNotifications]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'work_in_progress':
        return <Clock className="h-4 w-4 text-indigo-400" />;
      case 'reported':
        return <Info className="h-4 w-4 text-blue-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
  };

  // Role-based filtering
  const filteredNotifications = notifications.filter((notif) => {
    if (currentUser.role === 'citizen') {
      const isMyIssue = issues.some((issue) => issue.id === notif.issue_id && issue.citizenId === currentUser.uid);
      return isMyIssue;
    } else if (currentUser.role === 'department_officer') {
      const officerDept = currentUser.department || 'roads';
      const isDeptIssue = issues.some((issue) => issue.id === notif.issue_id && issue.department?.toLowerCase() === officerDept.toLowerCase());
      return isDeptIssue;
    }
    return true;
  });

  return (
    <div className="relative">
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer hover:border-slate-700 transition-all"
      >
        <Bell className="h-4.5 w-4.5" />
        {filteredNotifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-rose-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown Notification List */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-2xl z-50 animate-scaleUp max-h-96 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-850">
              <span className="text-[10px] font-extrabold text-white uppercase tracking-widest">System Updates</span>
              <span className="text-[9px] text-slate-500 font-mono">{filteredNotifications.length} alerts</span>
            </div>

            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-[10px]">
                No recent notifications.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto mt-2 space-y-3 pr-1 divide-y divide-slate-850">
                {filteredNotifications.map((notif) => (
                  <div key={notif.id} className="flex gap-3 pt-3 first:pt-1">
                    <div className="shrink-0 mt-0.5">
                      {getStatusIcon(notif.status)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[10.5px] text-slate-200 font-medium leading-tight">
                        {notif.message}
                      </p>
                      <div className="flex justify-between items-center text-[9px] text-slate-500">
                        <span className="font-mono">Issue: #{notif.issue_id.slice(-6)}</span>
                        <span>{notif.relativeTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
