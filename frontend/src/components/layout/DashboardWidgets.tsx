import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Activity, 
  ShieldAlert, 
  Users, 
  Flame, 
  BarChart3 
} from 'lucide-react';

import type { Issue } from '../../App';

interface DashboardWidgetsProps {
  totalIssues: number;
  resolvedIssues: number;
  pendingIssues: number;
  criticalIssues: number;
  issues: Issue[];
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  totalIssues,
  resolvedIssues,
  pendingIssues,
  criticalIssues,
  issues,
}) => {
  
  // Compute department resolution performance from real issues data
  const departmentScorecard = useMemo(() => {
    const deptMap: Record<string, { name: string; resolved: number; total: number }> = {};
    
    issues.forEach(issue => {
      const dept = issue.department || 'unassigned';
      if (!deptMap[dept]) {
        deptMap[dept] = { name: dept, resolved: 0, total: 0 };
      }
      deptMap[dept].total += 1;
      if (issue.status === 'resolved' || issue.status === 'closed') {
        deptMap[dept].resolved += 1;
      }
    });

    const DEPT_COLORS = ['bg-emerald-500', 'bg-teal-500', 'bg-violet-500', 'bg-amber-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-rose-500'];

    return Object.values(deptMap)
      .sort((a, b) => b.total - a.total)
      .map((dept, idx) => ({
        name: dept.name.charAt(0).toUpperCase() + dept.name.slice(1) + ' Department',
        completed: dept.total > 0 ? Math.round((dept.resolved / dept.total) * 100) : 0,
        active: dept.total - dept.resolved,
        color: DEPT_COLORS[idx % DEPT_COLORS.length],
      }));
  }, [issues]);

  // Compute real weekly report data from issue creation dates
  const weeklyData = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Initialize counts for each day of the week
    const dayCounts: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayCounts[dayNames[d.getDay()]] = 0;
    }

    // Count issues created in the past 7 days
    issues.forEach(issue => {
      if (issue.createdAt) {
        const created = new Date(issue.createdAt);
        if (created >= sevenDaysAgo && created <= now) {
          const dayKey = dayNames[created.getDay()];
          dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
        }
      }
    });

    // Build ordered array for last 7 days
    const result: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayKey = dayNames[d.getDay()];
      result.push({ day: dayKey, count: dayCounts[dayKey] || 0 });
    }
    return result;
  }, [issues]);

  // Compute AI routing accuracy from real confidence data
  const aiMetrics = useMemo(() => {
    const issuesWithDept = issues.filter(i => i.department);
    const issuesWithConfidence = issues.filter(i => i.aiConfidence && i.aiConfidence > 0);
    
    // Routing accuracy: percentage of issues with a department successfully assigned
    const routingAccuracy = issues.length > 0
      ? Math.round((issuesWithDept.length / issues.length) * 100)
      : 0;

    // Trending hotspot: find the most common area/address segment
    const areaCounts: Record<string, number> = {};
    issues.forEach(issue => {
      if (issue.address) {
        // Extract the most meaningful part of the address (second segment often = area/locality)
        const parts = issue.address.split(',').map(s => s.trim());
        const area = parts.length >= 2 ? parts[1] : parts[0];
        if (area && area.length > 2) {
          areaCounts[area] = (areaCounts[area] || 0) + 1;
        }
      }
    });
    
    let trendingHotspot = 'No data yet';
    let maxAreaCount = 0;
    Object.entries(areaCounts).forEach(([area, count]) => {
      if (count > maxAreaCount) {
        maxAreaCount = count;
        trendingHotspot = area;
      }
    });

    // Citizen coordinated actions: total verifications + upvotes + comments as community engagement metric
    const totalVerifications = issues.reduce((sum, i) => sum + (i.verificationCount || 0), 0);
    const totalUpvotes = issues.reduce((sum, i) => sum + (i.upvotesCount || 0), 0);
    const communityActions = totalVerifications + totalUpvotes;

    // Average AI confidence
    const avgConfidence = issuesWithConfidence.length > 0
      ? Math.round(issuesWithConfidence.reduce((sum, i) => sum + (i.aiConfidence || 0), 0) / issuesWithConfidence.length * 100)
      : 0;

    return { routingAccuracy, trendingHotspot, communityActions, avgConfidence };
  }, [issues]);

  const maxWeeklyCount = Math.max(...weeklyData.map(d => d.count), 1);

  return (
    <div className="space-y-8">
      {/* 4-Column Core Statistics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total issues card */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Reports</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-white mt-2 font-mono">{totalIssues}</h3>
          <p className="text-[9px] text-slate-400 mt-1">Hyperlocal complaints filed</p>
        </div>

        {/* Resolved issues card */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-white mt-2 font-mono">{resolvedIssues}</h3>
          <p className="text-[9px] text-emerald-400 mt-1">Successfully addressed</p>
        </div>

        {/* Pending issues card */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pending</span>
            <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-white mt-2 font-mono">{pendingIssues}</h3>
          <p className="text-[9px] text-slate-400 mt-1">Active investigations</p>
        </div>

        {/* Critical issues card */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Critical Hazard</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <h3 className="text-2xl font-black text-rose-400 mt-2 font-mono">{criticalIssues}</h3>
          <p className="text-[9px] text-rose-400/80 mt-1">Immediate action required</p>
        </div>

      </div>

      {/* Analytics & Performance section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Weekly Trend Graph Card */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Weekly reports volume
            </h4>
            <p className="text-[10px] text-slate-500">Incident filings over the last 7 days</p>
          </div>

          <div className="h-32 flex items-end justify-between gap-2.5 px-2 mt-6">
            {weeklyData.map((data, idx) => {
              const heightPercent = maxWeeklyCount > 0 ? (data.count / maxWeeklyCount) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div 
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-gradient-to-t from-emerald-500/20 to-emerald-400 rounded-t-lg min-h-2 relative group cursor-pointer transition-all hover:to-emerald-300"
                  >
                    {/* Hover tooltips */}
                    <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-slate-950 text-white font-mono text-[9px] py-0.5 px-1.5 rounded border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                      {data.count}
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium">{data.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Resolution Index Card */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            Department scorecard
          </h4>
          <p className="text-[10px] text-slate-500 mb-5">Successful resolution rates by sector</p>

          {departmentScorecard.length === 0 ? (
            <p className="text-[10px] text-slate-500 italic text-center py-4">No reports available.</p>
          ) : (
            <div className="space-y-3.5">
              {departmentScorecard.map((dept, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[9px] font-semibold">
                    <span className="text-slate-400 truncate max-w-[180px]">{dept.name}</span>
                    <span className="text-white font-mono">{dept.completed}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                    <div 
                      style={{ width: `${dept.completed}%` }}
                      className={`h-full rounded-full ${dept.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Efficiency & Community Metrics Card */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <Users className="h-4 w-4 text-emerald-400" />
              Community AI Health
            </h4>
            <p className="text-[10px] text-slate-500">Autonomous systems & engagement ratings</p>
          </div>

          <div className="space-y-4 my-4">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-[10px] text-slate-400">AI Routing Accuracy</span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {issues.length > 0 ? `${aiMetrics.routingAccuracy}%` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-[10px] text-slate-400">Trending Hotspot Zone</span>
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-rose-500 fill-rose-500/20" />
                {aiMetrics.trendingHotspot}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-[10px] text-slate-400">Community Engagement</span>
              <span className="text-xs font-bold text-slate-300 font-mono">
                {aiMetrics.communityActions.toLocaleString()} actions
              </span>
            </div>
          </div>

          <p className="text-[9px] text-slate-500 leading-normal text-center italic">
            {issues.length > 0 
              ? 'AI validation loops running. Department dispatches synchronized.'
              : 'No reports available.'}
          </p>
        </div>

      </div>
    </div>
  );
};
