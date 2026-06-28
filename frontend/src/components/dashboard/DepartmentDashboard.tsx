import React, { useState } from 'react';
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  MapPin,
  Hammer,
  TrendingUp
} from 'lucide-react';
import { UpdateStatusModal } from '../verification/UpdateStatusModal';
import { IssueLifecycleTimeline } from '../verification/IssueLifecycleTimeline';
import type { Issue } from '../../App';

interface DepartmentDashboardProps {
  issues: Issue[];
  currentUser: { uid: string; role: string; name: string; department?: string };
  apiBaseUrl: string;
  onRefresh: () => void;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({
  issues,
  currentUser,
  apiBaseUrl,
  onRefresh
}) => {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [queueTab, setQueueTab] = useState<'my_tasks' | 'dept_queue'>('my_tasks');

  const officerDept = currentUser.department || 'roads';

  // Filter issues for this officer's department
  const deptIssues = issues.filter(issue => issue.department?.toLowerCase() === officerDept.toLowerCase());
  
  // Specific tasks sets
  const myAssignedIssues = deptIssues.filter(issue => issue.officer_id === currentUser.uid);
  const deptQueue = deptIssues.filter(issue => !issue.officer_id);

  // Calculate metrics based on Officer
  const pendingInspections = myAssignedIssues.filter(issue => issue.status === 'inspection_scheduled');
  const todayTasks = myAssignedIssues.filter(issue => 
    ['work_in_progress', 'investigation_started', 'repair_approved'].includes(issue.status)
  );
  
  // Calculate average completion time
  const myCompletedIssues = deptIssues.filter(issue => 
    issue.officer_id === currentUser.uid && (issue.status === 'resolved' || issue.status === 'closed')
  );
  let avgCompletionTimeStr: string;
  if (myCompletedIssues.length > 0) {
    const totalMs = myCompletedIssues.reduce((acc, issue) => {
      const start = new Date(issue.createdAt || '').getTime();
      const end = new Date(issue.resolution_date || issue.updatedAt || '').getTime();
      const diff = end - start;
      return acc + (diff > 0 ? diff : 0);
    }, 0);
    const avgDays = (totalMs / myCompletedIssues.length) / (1000 * 60 * 60 * 24);
    avgCompletionTimeStr = `${avgDays.toFixed(1)}d`;
  } else {
    // Fallback to department average
    const deptCompletedIssues = deptIssues.filter(issue => 
      issue.status === 'resolved' || issue.status === 'closed'
    );
    if (deptCompletedIssues.length > 0) {
      const totalMs = deptCompletedIssues.reduce((acc, issue) => {
        const start = new Date(issue.createdAt || '').getTime();
        const end = new Date(issue.resolution_date || issue.updatedAt || '').getTime();
        const diff = end - start;
        return acc + (diff > 0 ? diff : 0);
      }, 0);
      const avgDays = (totalMs / deptCompletedIssues.length) / (1000 * 60 * 60 * 24);
      avgCompletionTimeStr = `${avgDays.toFixed(1)}d`;
    } else {
      avgCompletionTimeStr = '0.0d';
    }
  }

  // Filter issues based on selected tab and status filter
  const targetIssueList = queueTab === 'my_tasks' ? myAssignedIssues : deptQueue;
  const filteredIssues = targetIssueList.filter(issue => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return issue.status !== 'closed' && issue.status !== 'resolved';
    if (statusFilter === 'completed') return issue.status === 'resolved' || issue.status === 'closed';
    return issue.status === statusFilter;
  });

  const selectedIssue = deptIssues.find(issue => issue.id === selectedIssueId);

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
    <div className="space-y-6">
      
      {/* 4-Column Department Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Assigned Issues</span>
            <Briefcase className="h-4 w-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-white mt-2 font-mono">{myAssignedIssues.length}</h3>
          <p className="text-[9px] text-slate-400 mt-1">My assigned tickets</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today's Tasks</span>
            <Hammer className="h-4 w-4 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-black text-indigo-400 mt-2 font-mono">{todayTasks.length}</h3>
          <p className="text-[9px] text-indigo-400 mt-1">Active repair works</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inspections</span>
            <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-white mt-2 font-mono">{pendingInspections.length}</h3>
          <p className="text-[9px] text-slate-400 mt-1">Awaiting inspection</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Completion</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-emerald-400 mt-2 font-mono">{avgCompletionTimeStr}</h3>
          <p className="text-[9px] text-emerald-400 mt-1">Average resolution speed</p>
        </div>
      </div>

      {/* Main split dashboard section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[450px]">
        
        {/* Left Column: Assigned Task List */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800/50 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setQueueTab('my_tasks')}
                className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${
                  queueTab === 'my_tasks'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    : 'text-slate-450 hover:text-slate-200 border border-transparent'
                }`}
              >
                My Tasks ({myAssignedIssues.length})
              </button>
              <button
                onClick={() => setQueueTab('dept_queue')}
                className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${
                  queueTab === 'dept_queue'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    : 'text-slate-450 hover:text-slate-200 border border-transparent'
                }`}
              >
                Dept Queue ({deptQueue.length})
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[10px] bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-slate-300 font-bold focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="completed">Completed Only</option>
              <option value="work_in_progress">Work In Progress</option>
              <option value="reported">Reported</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-xl">
              <CheckCircle2 className="h-8 w-8 text-slate-600" />
              <p className="text-xs font-semibold text-slate-400">All tasks completed</p>
              <p className="text-[10px] text-slate-500 max-w-[200px]">No issues currently match your filter criteria.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {filteredIssues.map(issue => (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedIssueId === issue.id 
                      ? 'bg-slate-800/50 border-emerald-500/50 shadow-md shadow-emerald-500/5' 
                      : 'bg-slate-950/40 border-slate-800/50 hover:bg-slate-800/20'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono text-slate-500">#{issue.id.slice(-6)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        issue.severity === 'critical' ? 'bg-rose-500 animate-ping' : 
                        issue.severity === 'high' ? 'bg-orange-500' : 'bg-slate-500'
                      }`} />
                      {getStatusBadge(issue.status)}
                    </div>
                  </div>
                  <h3 className="text-xs font-bold text-white line-clamp-1">{issue.title}</h3>
                  {issue.aiSummary ? (
                    <p className="text-[9px] text-violet-400 italic line-clamp-2 mt-0.5 leading-relaxed">
                      🤖 {issue.aiSummary}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-1">{issue.description}</p>
                  )}
                  <div className="flex justify-between items-center mt-3 text-[9px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      {issue.address.split(',')[0]}
                    </span>
                    {issue.technician_name && (
                      <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 font-mono">
                        Tech: {issue.technician_name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Incident Work Panel */}
        <div className="lg:col-span-7">
          {selectedIssue ? (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-6">
              
              {/* Header Details */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Active Dispatch Panel</span>
                    <span className="text-[9px] font-mono text-slate-500">#{selectedIssue.id}</span>
                  </div>
                  <h2 className="text-base font-extrabold text-white mt-1">{selectedIssue.title}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    {getStatusBadge(selectedIssue.status)}
                    <span className="text-[10px] text-slate-450 font-bold capitalize">Severity: {selectedIssue.severity}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  Transition Lifecycle
                </button>
              </div>

              {/* Media file proof */}
              {selectedIssue.publicImageUrl && (
                <div className="relative aspect-video max-h-[220px] rounded-xl overflow-hidden border border-slate-800">
                  <img 
                    src={selectedIssue.publicImageUrl} 
                    alt={selectedIssue.title} 
                    className="object-cover w-full h-full"
                  />
                </div>
              )}

              {selectedIssue.aiSummary && (
                <div className="p-3 bg-violet-950/20 border border-violet-700/30 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block">🤖 AI Executive Summary</span>
                  <p className="text-[11px] text-violet-200 leading-relaxed">{selectedIssue.aiSummary}</p>
                  {selectedIssue.estimated_completion_date && (
                    <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-400">
                      <span className="font-bold uppercase tracking-wider">Est. Completion:</span>
                      <span className="font-mono">{selectedIssue.estimated_completion_date}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Extended fields specifications cards */}
              <div className="grid grid-cols-2 gap-4 text-[10px] bg-slate-950/20 border border-slate-800/30 p-4 rounded-xl">
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Assigned Worker/Technician</span>
                  <span className="text-slate-300 font-semibold">{selectedIssue.technician_name || 'Not assigned yet'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Inspection Date</span>
                  <span className="text-slate-300 font-semibold">{selectedIssue.inspection_date || 'Not scheduled yet'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Estimated Repair Cost</span>
                  <span className="text-slate-300 font-mono font-semibold">
                    {selectedIssue.estimated_cost ? `$${selectedIssue.estimated_cost}` : 'Not estimated yet'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Materials Registered</span>
                  <span className="text-slate-300 font-semibold">{selectedIssue.material_used || 'None listed'}</span>
                </div>
                {selectedIssue.citizen_verified && (
                  <div className="col-span-2 pt-2 border-t border-slate-800/30 flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Citizen verified work completion</span>
                  </div>
                )}
              </div>

              {/* Timeline Tracker */}
              <div className="border-t border-slate-800/50 pt-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Timeline Events</h3>
                <IssueLifecycleTimeline issueId={selectedIssue.id} apiBaseUrl={apiBaseUrl} />
              </div>

            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/20 border border-slate-800/40 backdrop-blur-sm text-center text-slate-500">
              <AlertTriangle className="h-10 w-10 text-slate-700 mb-2" />
              <h3 className="text-sm font-bold text-slate-400">Select a dispatch case</h3>
              <p className="text-[10px] text-slate-500 max-w-[285px] mt-1">Select an incident from the assigned task queue on the left to begin scheduling inspections, deploying technicians, or logging completions.</p>
            </div>
          )}
        </div>

      </div>

      {/* Update lifecycle modal */}
      {selectedIssue && (
        <UpdateStatusModal
          isOpen={isUpdateModalOpen}
          onClose={() => {
            setIsUpdateModalOpen(false);
            onRefresh();
          }}
          issueId={selectedIssue.id}
          currentStatus={selectedIssue.status}
          currentDepartment={selectedIssue.department || ''}
          apiBaseUrl={apiBaseUrl}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

    </div>
  );
};
