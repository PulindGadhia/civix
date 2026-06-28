/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  ShieldAlert, 
  Users,
  BarChart3,
  BrainCircuit,
  Map,
  UserCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Building,
  Archive,
  UserPlus,
  UserX,
  Lock,
  Mail,
  Phone,
  Calendar,
  X,
  TrendingUp,
  Layers,
  Activity
} from 'lucide-react';
import { showToast } from '../../utils/toast';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import { LeafletMapContainer } from '../map/LeafletMapContainer';

import type { Issue } from '../../App';

interface Department {
  id: string;
  departmentId: string;
  name: string;
  departmentName: string;
  description: string;
  headOfficer: string | null;
  numberOfOfficers: number;
  officers_count?: number; // legacy
  activeIssues: number;
  pending_count?: number; // legacy
  completedIssues: number;
  resolved_count?: number; // legacy
  averageResolutionTime: number;
  performanceScore: number;
  status: 'Active' | 'Archived';
}

interface Officer {
  id: string;
  uid: string;
  fullName: string;
  name?: string; // legacy
  email: string;
  phone: string;
  department: string;
  designation: string;
  status: 'Active' | 'Disabled';
  permissions: string[];
  joinedDate: string;
  performanceScore: number;
  currentWorkload: number;
  completedIssues: number;
  activeIssues: string[];
  averageResolutionTime: number;
}

interface AdminActivity {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  adminId: string;
  adminName: string;
  timestamp: string;
}

interface AdminDashboardProps {
  issues: Issue[];
  currentUser: { uid: string; role: string; name: string };
  apiBaseUrl: string;
  onRefresh: () => void;
  onSelectOnMap: (issue: Issue) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  issues,
  currentUser,
  apiBaseUrl,
  onRefresh,
  onSelectOnMap: _onSelectOnMap
}) => {
  const todayStr = useMemo(() => new Date().toDateString(), []);
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  // Navigation State
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'analytics' | 'users' | 'officers' | 'departments'>('overview');

  // Queue Triage Filters
  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintDeptFilter, setComplaintDeptFilter] = useState('');
  const [complaintPriorityFilter, setComplaintPriorityFilter] = useState('');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('');

  // Core Data Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // AI Command Center states
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [aiPredictions, setAiPredictions] = useState<any | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isGeneratingPredictions, setIsGeneratingPredictions] = useState(false);

  // Selected details for override
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  
  // Reassignment Form state
  const [targetDept, setTargetDept] = useState('');
  const [targetOfficerId, setTargetOfficerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Override Form states
  const [targetCategory, setTargetCategory] = useState('');
  const [targetPriority, setTargetPriority] = useState('');
  const [targetSeverity, setTargetSeverity] = useState('low');
  const [targetEscalated, setTargetEscalated] = useState(false);
  const [targetDeadline, setTargetDeadline] = useState('');
  const [targetInternalNotes, setTargetInternalNotes] = useState('');

  // User management UI state
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userSortField, setUserSortField] = useState('fullName');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);

  // Form states for updates
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserStatus, setEditUserStatus] = useState('');
  const [editUserDept, setEditUserDept] = useState('');
  const [editUserDesignation, setEditUserDesignation] = useState('');

  // Officer Modals state
  const [isCreateOfficerOpen, setIsCreateOfficerOpen] = useState(false);
  const [isTransferOfficerOpen, setIsTransferOfficerOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);

  // Create Officer form state
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerEmail, setNewOfficerEmail] = useState('');
  const [newOfficerPhone, setNewOfficerPhone] = useState('');
  const [newOfficerPassword, setNewOfficerPassword] = useState('');
  const [newOfficerDept, setNewOfficerDept] = useState('');
  const [newOfficerDesignation, setNewOfficerDesignation] = useState('');

  // Transfer Officer form state
  const [transferDept, setTransferDept] = useState('');
  const [transferDesignation, setTransferDesignation] = useState('');

  // Department Modals state
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [isEditDeptOpen, setIsEditDeptOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  // Department Form state
  const [newDeptId, setNewDeptId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptDesc, setEditDeptDesc] = useState('');
  const [editDeptHead, setEditDeptHead] = useState('');

  // Load all municipal data from backend
  const fetchData = React.useCallback(async () => {
    try {
      const [deptRes, officerRes, usersRes, activityRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/api/v1/departments`),
        axios.get(`${apiBaseUrl}/api/v1/officers`),
        axios.get(`${apiBaseUrl}/api/v1/admin/users`),
        axios.get(`${apiBaseUrl}/api/v1/admin/activity`)
      ]);
      
      // Standardize departments count variables
      const deptList = deptRes.data.map((d: any) => ({
        ...d,
        numberOfOfficers: d.numberOfOfficers ?? d.officers_count ?? 0,
        activeIssues: d.activeIssues ?? d.pending_count ?? 0,
        completedIssues: d.completedIssues ?? d.resolved_count ?? 0,
      }));
      setDepartments(deptList);
      
      // Standardize officers fields
      const offList = officerRes.data.map((o: any) => ({
        ...o,
        fullName: o.fullName ?? o.name ?? 'Officer',
        performanceScore: o.performanceScore ?? o.performance_score ?? 90,
        currentWorkload: o.currentWorkload ?? o.current_workload ?? 0,
        completedIssues: o.completedIssues ?? o.completed_issues ?? 0,
        averageResolutionTime: o.averageResolutionTime ?? o.average_resolution_time ?? 2.4,
      }));
      setOfficers(offList);

      if (usersRes.data && usersRes.data.success) {
        setUsers(usersRes.data.users);
      }
      if (Array.isArray(activityRes.data)) {
        setActivities(activityRes.data);
      }
    } catch (err) {
      console.error('Failed to load admin metadata:', err);
    }
  }, [apiBaseUrl]);

  // Real-time updates via snapshot listeners when Firestore is configured
  useEffect(() => {
    let unsubDepts: (() => void) | undefined;
    let unsubOfficers: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubActivities: (() => void) | undefined;
    let unsubNotifications: (() => void) | undefined;

    if (isFirebaseConfigured && db) {
      try {
        unsubDepts = onSnapshot(collection(db, 'departments'), (snapshot) => {
          const list: Department[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            list.push({
              ...data,
              numberOfOfficers: data.numberOfOfficers ?? data.officers_count ?? 0,
              activeIssues: data.activeIssues ?? data.pending_count ?? 0,
              completedIssues: data.completedIssues ?? data.resolved_count ?? 0,
            });
          });
          setDepartments(list);
        }, (err) => console.error('Firestore departments snapshot error:', err));

        unsubOfficers = onSnapshot(collection(db, 'officers'), (snapshot) => {
          const list: Officer[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            list.push({
              ...data,
              fullName: data.fullName ?? data.name ?? 'Officer',
              performanceScore: data.performanceScore ?? data.performance_score ?? 90,
              currentWorkload: data.currentWorkload ?? data.current_workload ?? 0,
              completedIssues: data.completedIssues ?? data.completed_issues ?? 0,
              averageResolutionTime: data.averageResolutionTime ?? data.average_resolution_time ?? 2.4,
            });
          });
          setOfficers(list);
        }, (err) => console.error('Firestore officers snapshot error:', err));

        unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data());
          });
          setUsers(list);
        }, (err) => console.error('Firestore users snapshot error:', err));

        unsubActivities = onSnapshot(collection(db, 'admin_activity'), (snapshot) => {
          const list: AdminActivity[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as AdminActivity);
          });
          list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
          setActivities(list);
        }, (err) => console.error('Firestore admin_activity snapshot error:', err));

        unsubNotifications = onSnapshot(collection(db, 'issue_notifications'), (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
          setNotifications(list);
        }, (err) => console.error('Firestore notifications snapshot error:', err));

      } catch (err) {
        console.error('Failed to setup Firestore listeners in AdminDashboard:', err);
        fetchData();
      }
    } else {
      fetchData();
    }

    return () => {
      if (unsubDepts) unsubDepts();
      if (unsubOfficers) unsubOfficers();
      if (unsubUsers) unsubUsers();
      if (unsubActivities) unsubActivities();
      if (unsubNotifications) unsubNotifications();
    };
  }, [fetchData]);

  const selectedIssue = issues.find(issue => issue.id === selectedIssueId);

  // Global KPIs calculations
  const {
    totalIssues,
    resolvedIssues,
    pendingIssues,
    criticalIssues,
    pendingVerification,
    reopenedIssues,
    escalatedIssues,
    avgResolutionTime,
    citizenSatisfaction,
    aiAccuracyRate,
    slaCompliance,
    avgOfficerWorkload,
    departmentsOnline,
    officersAvailable
  } = useMemo(() => {
    const total = issues.length;
    const resolved = issues.filter(issue => issue.status === 'resolved' || issue.status === 'closed').length;
    const pending = issues.filter(issue => issue.status !== 'resolved' && issue.status !== 'closed').length;
    const critical = issues.filter(issue => issue.severity === 'critical').length;
    const verifPending = issues.filter(issue => issue.status === 'citizen_verification_pending' || issue.status === 'repair_completed').length;
    const reopened = issues.filter(issue => issue.status === 'reopened').length;
    const escalated = issues.filter(issue => issue.escalated).length;

    // Calculate Average Resolution Time (in days)
    const resolvedWithTime = issues.filter(i => i.createdAt && i.resolution_date);
    let avgResTime = 2.4; // default fallback
    if (resolvedWithTime.length > 0) {
      const totalTime = resolvedWithTime.reduce((sum, i) => {
        const start = new Date(i.createdAt || '').getTime();
        const end = new Date(i.resolution_date || '').getTime();
        return sum + (end - start);
      }, 0);
      avgResTime = Number((totalTime / resolvedWithTime.length / (1000 * 3600 * 24)).toFixed(1));
    }

    // Calculate Citizen Satisfaction (satisfaction percentage)
    const ratedIssues = issues.filter(i => i.citizen_rating && i.citizen_rating > 0);
    let satisfaction = 88; // default fallback
    if (ratedIssues.length > 0) {
      const avgRating = ratedIssues.reduce((sum, i) => sum + (i.citizen_rating || 0), 0) / ratedIssues.length;
      satisfaction = Math.round((avgRating / 5) * 100);
    }

    // AI Accuracy Rate
    const aiHighConfidenceIssues = issues.filter(issue => (issue.aiConfidence || 0) > 0.8);
    const accuracy = aiHighConfidenceIssues.length > 0
      ? Math.round((aiHighConfidenceIssues.filter(i => i.department).length / aiHighConfidenceIssues.length) * 100)
      : 85;

    // SLA Compliance
    const now = new Date();
    const compliant = issues.filter(i => {
      const deadline = i.deadline || i.estimated_completion_date;
      if (!deadline) return true;
      if (i.status === 'resolved' || i.status === 'closed') {
        const resTime = i.resolution_date ? new Date(i.resolution_date) : now;
        return resTime <= new Date(deadline);
      }
      return new Date(deadline) >= now;
    });
    const sla = total > 0 ? Math.round((compliant.length / total) * 100) : 100;

    // Avg Officer Workload
    const totalWorkload = officers.reduce((sum, o) => sum + (o.currentWorkload || 0), 0);
    const avgWorkload = officers.length > 0 ? Number((totalWorkload / officers.length).toFixed(1)) : 0;

    // Departments Online
    const deptsOnline = departments.filter(d => d.status === 'Active').length;

    // Officers Available
    const offAvailable = officers.filter(o => o.status === 'Active').length;

    return {
      totalIssues: total,
      resolvedIssues: resolved,
      pendingIssues: pending,
      criticalIssues: critical,
      pendingVerification: verifPending,
      reopenedIssues: reopened,
      escalatedIssues: escalated,
      avgResolutionTime: avgResTime,
      citizenSatisfaction: satisfaction,
      aiAccuracyRate: accuracy,
      slaCompliance: sla,
      avgOfficerWorkload: avgWorkload,
      departmentsOnline: deptsOnline,
      officersAvailable: offAvailable
    };
  }, [issues, officers, departments]);

  // Sector Load metrics
  const sectorMetrics = useMemo(() => {
    return departments.map(d => {
      const active = issues.filter(i => i.department === d.id && i.status !== 'resolved' && i.status !== 'closed').length;
      const completed = issues.filter(i => i.department === d.id && (i.status === 'resolved' || i.status === 'closed')).length;
      const total = active + completed;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 100;
      return {
        ...d,
        activeIssues: active,
        completedIssues: completed,
        rate
      };
    });
  }, [departments, issues]);

  // Top Performing Officers
  const topOfficers = useMemo(() => {
    return [...officers]
      .filter(o => o.status === 'Active')
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 5);
  }, [officers]);

  // Executive Alerts Engine (Module 8)
  const executiveAlerts = useMemo(() => {
    const alerts: { id: string; type: 'warning' | 'error' | 'info'; title: string; message: string }[] = [];

    // 1. Department Overload
    departments.forEach(d => {
      if (d.activeIssues > 5) {
        alerts.push({
          id: `dept-overload-${d.id}`,
          type: 'error',
          title: 'Department Overload Alert',
          message: `${d.departmentName || d.name} has ${d.activeIssues} active issues pending. Dispatch optimization needed.`
        });
      }
    });

    // 2. Officer Overload
    officers.forEach(o => {
      if (o.currentWorkload > 3) {
        alerts.push({
          id: `off-overload-${o.uid || o.id}`,
          type: 'warning',
          title: 'Officer Overload Warning',
          message: `Officer ${o.fullName} has ${o.currentWorkload} assignments. Exceeds capacity threshold.`
        });
      }
    });

    // 3. SLA Violation / Overdue
    const today = new Date();
    issues.forEach(i => {
      if (i.status !== 'resolved' && i.status !== 'closed') {
        const deadline = i.deadline || i.estimated_completion_date;
        if (deadline && new Date(deadline) < today) {
          alerts.push({
            id: `sla-${i.id}`,
            type: 'error',
            title: i.severity === 'critical' ? 'Critical SLA Violation' : 'SLA Compliance Overdue',
            message: `Issue #${i.id.slice(-6).toUpperCase()} (${i.title}) has exceeded its resolution SLA target.`
          });
        }
      }
    });

    // 4. Low AI Confidence Referral
    issues.forEach(i => {
      if (i.aiConfidence && i.aiConfidence < 0.6 && i.status === 'reported') {
        alerts.push({
          id: `low-ai-${i.id}`,
          type: 'info',
          title: 'Low AI Confidence Referral',
          message: `Issue #${i.id.slice(-6).toUpperCase()} routed with low confidence (${Math.round(i.aiConfidence * 100)}%). Manual audit required.`
        });
      }
    });

    return alerts;
  }, [issues, departments, officers]);

  // Resolved issues today
  const resolvedIssuesToday = useMemo(() => {
    const today = new Date().toDateString();
    return issues.filter(i => 
      (i.status === 'resolved' || i.status === 'closed') && 
      i.resolution_date && 
      new Date(i.resolution_date).toDateString() === today
    ).length;
  }, [issues]);

  // Filtered queue issues
  const filteredQueueIssues = useMemo(() => {
    let list = [...issues];
    
    if (complaintSearch.trim()) {
      const q = complaintSearch.toLowerCase();
      list = list.filter(i => 
        (i.title || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.id || '').toLowerCase().includes(q)
      );
    }
    if (complaintDeptFilter) {
      list = list.filter(i => i.department === complaintDeptFilter);
    }
    if (complaintPriorityFilter) {
      list = list.filter(i => i.priority === complaintPriorityFilter);
    }
    if (complaintStatusFilter) {
      list = list.filter(i => i.status === complaintStatusFilter);
    }
    
    // Sort critical first, then recent
    list.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const wA = priorityWeight[a.priority as 'low' | 'medium' | 'high' | 'critical'] || 0;
      const wB = priorityWeight[b.priority as 'low' | 'medium' | 'high' | 'critical'] || 0;
      if (wA !== wB) return wB - wA;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    
    return list;
  }, [issues, complaintSearch, complaintDeptFilter, complaintPriorityFilter, complaintStatusFilter]);

  // Recommended Officer (lowest workload)
  const recommendedOfficer = useMemo(() => {
    if (!selectedIssue) return null;
    const deptId = selectedIssue.department;
    if (!deptId) return null;
    const deptOfficers = officers.filter(o => o.department === deptId && o.status === 'Active');
    if (deptOfficers.length === 0) return null;
    return [...deptOfficers].sort((a, b) => a.currentWorkload - b.currentWorkload)[0];
  }, [selectedIssue, officers]);

  // Close / Resolve Complaint
  const handleCloseComplaint = async () => {
    if (!selectedIssueId || isSubmitting) return;
    if (!window.confirm('Are you sure you want to officially resolve and close this complaint?')) return;
    
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('status', 'resolved');
      formData.append('updated_by', currentUser.name || 'Administrator');
      formData.append('notes', 'Administrator marked complaint as RESOLVED & CLOSED.');
      
      const response = await axios.post(
        `${apiBaseUrl}/api/v1/issues/${selectedIssueId}/status`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      if (response.data.success) {
        showToast('Complaint resolved and closed successfully.', 'success');
        onRefresh();
        fetchData();
      }
    } catch (err) {
      console.error('Failed to close complaint:', err);
      showToast('Failed to close complaint.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Command Center handlers (Module 3 & Module 9)
  const handleGenerateInsights = async () => {
    if (isGeneratingInsights) return;
    setIsGeneratingInsights(true);
    try {
      const deptStats = departments.map(d => ({
        name: d.departmentName || d.name,
        active: d.activeIssues,
        resolved: d.completedIssues
      }));
      const offStats = officers.map(o => ({
        name: o.fullName,
        workload: o.currentWorkload,
        rating: o.performanceScore
      }));
      const recent = issues.slice(0, 5).map(i => ({
        title: i.title,
        category: i.category,
        createdAt: i.createdAt
      }));

      const res = await axios.post(`${apiBaseUrl}/api/v1/admin/ai-insights`, {
        total_issues: totalIssues,
        active_issues: pendingIssues,
        resolved_issues: resolvedIssues,
        critical_issues: criticalIssues,
        department_stats: deptStats,
        officer_stats: offStats,
        recent_complaints: recent
      });

      if (res.data?.success) {
        setAiInsights(res.data.insights);
        showToast('AI command insights generated successfully.', 'success');
      }
    } catch (err) {
      console.error('Failed to generate insights:', err);
      showToast('Insights generation failed.', 'error');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleGeneratePredictions = async () => {
    if (isGeneratingPredictions) return;
    setIsGeneratingPredictions(true);
    try {
      const deptStats = departments.map(d => ({
        name: d.departmentName || d.name,
        active: d.activeIssues,
        resolved: d.completedIssues
      }));
      const offStats = officers.map(o => ({
        name: o.fullName,
        workload: o.currentWorkload,
        rating: o.performanceScore
      }));
      const recent = issues.slice(0, 5).map(i => ({
        title: i.title,
        category: i.category,
        createdAt: i.createdAt
      }));

      const res = await axios.post(`${apiBaseUrl}/api/v1/admin/ai-predictions`, {
        total_issues: totalIssues,
        active_issues: pendingIssues,
        resolved_issues: resolvedIssues,
        critical_issues: criticalIssues,
        department_stats: deptStats,
        officer_stats: offStats,
        recent_complaints: recent
      });

      if (res.data?.success) {
        if (res.data.sufficient) {
          setAiPredictions(res.data.predictions);
          showToast('Predictive analytics generated.', 'success');
        } else {
          setAiPredictions({ insufficient: true, message: res.data.message });
        }
      }
    } catch (err) {
      console.error('Failed to generate predictions:', err);
      showToast('Predictions generation failed.', 'error');
    } finally {
      setIsGeneratingPredictions(false);
    }
  };

  // Pending Officer Accounts
  const pendingOfficers = useMemo(() => {
    return users.filter(u => u.role === 'department_officer' && u.status === 'Disabled');
  }, [users]);

  // User Management: Filtering, Sorting, Pagination
  const filteredUsers = useMemo(() => {
    let list = [...users];
    
    if (userSearch.trim()) {
      const query = userSearch.toLowerCase();
      list = list.filter(u => 
        (u.fullName || '').toLowerCase().includes(query) ||
        (u.email || '').toLowerCase().includes(query) ||
        (u.uid || '').toLowerCase().includes(query)
      );
    }
    
    if (userRoleFilter) {
      list = list.filter(u => u.role === userRoleFilter);
    }
    
    if (userStatusFilter) {
      list = list.filter(u => u.status === userStatusFilter);
    }
    
    if (userDeptFilter) {
      list = list.filter(u => u.department === userDeptFilter);
    }

    // Sort
    list.sort((a, b) => {
      const valA = (a[userSortField] || '').toString().toLowerCase();
      const valB = (b[userSortField] || '').toString().toLowerCase();
      if (valA < valB) return userSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return userSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [users, userSearch, userRoleFilter, userStatusFilter, userDeptFilter, userSortField, userSortOrder]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * 8;
    return filteredUsers.slice(start, start + 8);
  }, [filteredUsers, userPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / 8) || 1;

  // Actions
  const handleSaveOverrides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('status', selectedIssue?.status || 'pending_administrator_review');
      formData.append('updated_by', currentUser.name || 'Administrator');
      formData.append('notes', 'Administrator updated override parameters.');
      
      if (targetDept) formData.append('department', targetDept);
      if (targetOfficerId) {
        formData.append('officer_id', targetOfficerId);
        const officer = officers.find(o => (o.uid || o.id) === targetOfficerId);
        if (officer) {
          formData.append('officer_name', officer.fullName);
        }
      }
      if (targetCategory) formData.append('category', targetCategory);
      if (targetPriority) formData.append('priority', targetPriority);
      if (targetSeverity) formData.append('severity', targetSeverity);
      if (targetDeadline) formData.append('deadline', targetDeadline);
      formData.append('escalated', targetEscalated ? 'true' : 'false');
      if (targetInternalNotes) formData.append('internal_notes', targetInternalNotes);

      const response = await axios.post(
        `${apiBaseUrl}/api/v1/issues/${selectedIssueId}/status`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        showToast('Administrative overrides saved successfully!', 'success');
        onRefresh();
        fetchData();
      }
    } catch (err) {
      console.error('Failed to save overrides:', err);
      showToast('Failed to save overrides.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditUser = (user: any) => {
    setSelectedUser(user);
    setEditUserFullName(user.fullName || '');
    setEditUserRole(user.role || 'citizen');
    setEditUserStatus(user.status || 'Active');
    setEditUserDept(user.department || '');
    setEditUserDesignation(user.designation || '');
    setIsEditingUser(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await axios.patch(`${apiBaseUrl}/api/v1/admin/users/${selectedUser.uid}`, {
        fullName: editUserFullName,
        role: editUserRole,
        status: editUserStatus,
        department: editUserRole === 'department_officer' ? editUserDept : null,
        designation: editUserRole === 'department_officer' ? editUserDesignation : null
      });

      showToast('User profile updated successfully!', 'success');
      setIsEditingUser(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      console.error('Error updating user:', err);
      showToast('Failed to update user profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (user: any) => {
    const targetStatus = user.status === 'Active' ? 'Disabled' : 'Active';
    try {
      await axios.patch(`${apiBaseUrl}/api/v1/admin/users/${user.uid}`, {
        status: targetStatus
      });
      showToast(`User status updated to ${targetStatus}`, 'success');
      fetchData();
    } catch (err) {
      console.error('Error toggling user status:', err);
      showToast('Failed to update user status.', 'error');
    }
  };

  const handleResetPasswordSimulated = () => {
    showToast('Password reset link generated and queued for dispatch (Placeholder).', 'info');
  };

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/api/v1/admin/officers`, {
        fullName: newOfficerName,
        email: newOfficerEmail,
        password: newOfficerPassword,
        phone: newOfficerPhone,
        department: newOfficerDept,
        designation: newOfficerDesignation
      });

      if (response.data.success) {
        showToast('Officer account created successfully!', 'success');
        setIsCreateOfficerOpen(false);
        setNewOfficerName('');
        setNewOfficerEmail('');
        setNewOfficerPhone('');
        setNewOfficerPassword('');
        setNewOfficerDept('');
        setNewOfficerDesignation('');
        fetchData();
      }
    } catch (err: any) {
      console.error('Error creating officer:', err);
      showToast(err.response?.data?.error || 'Failed to create officer account.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTransfer = (officer: Officer) => {
    setSelectedOfficer(officer);
    setTransferDept(officer.department);
    setTransferDesignation(officer.designation);
    setIsTransferOfficerOpen(true);
  };

  const handleTransferOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await axios.patch(`${apiBaseUrl}/api/v1/admin/officers/${selectedOfficer.uid}`, {
        department: transferDept,
        designation: transferDesignation
      });

      showToast('Officer transferred and assignments updated.', 'success');
      setIsTransferOfficerOpen(false);
      setSelectedOfficer(null);
      fetchData();
    } catch (err) {
      console.error('Error transferring officer:', err);
      showToast('Failed to transfer officer.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateOfficer = async (officer: Officer) => {
    const targetStatus = officer.status === 'Active' ? 'Disabled' : 'Active';
    try {
      await axios.patch(`${apiBaseUrl}/api/v1/admin/officers/${officer.uid}`, {
        status: targetStatus
      });
      showToast(`Officer status updated to ${targetStatus}`, 'success');
      fetchData();
    } catch (err) {
      console.error('Error deactivating officer:', err);
      showToast('Failed to update officer status.', 'error');
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await axios.post(`${apiBaseUrl}/api/v1/admin/departments`, {
        departmentId: newDeptId.toLowerCase().replace(/\s+/g, '_'),
        departmentName: newDeptName,
        description: newDeptDesc
      });

      showToast('Municipal department created successfully!', 'success');
      setIsCreateDeptOpen(false);
      setNewDeptId('');
      setNewDeptName('');
      setNewDeptDesc('');
      fetchData();
    } catch (err) {
      console.error('Error creating department:', err);
      showToast('Failed to create department.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditDept = (dept: Department) => {
    setSelectedDept(dept);
    setEditDeptName(dept.departmentName || dept.name);
    setEditDeptDesc(dept.description || '');
    setEditDeptHead(dept.headOfficer || '');
    setIsEditDeptOpen(true);
  };

  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await axios.patch(`${apiBaseUrl}/api/v1/admin/departments/${selectedDept.departmentId || selectedDept.id}`, {
        departmentName: editDeptName,
        description: editDeptDesc,
        headOfficer: editDeptHead || null
      });

      showToast('Department details updated.', 'success');
      setIsEditDeptOpen(false);
      setSelectedDept(null);
      fetchData();
    } catch (err) {
      console.error('Error updating department:', err);
      showToast('Failed to update department.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveDept = async (dept: Department) => {
    if (!window.confirm(`Are you sure you want to archive the ${dept.departmentName || dept.name}? Historical statistics and issues will be preserved.`)) {
      return;
    }
    try {
      await axios.delete(`${apiBaseUrl}/api/v1/admin/departments/${dept.departmentId || dept.id}`);
      showToast('Department archived successfully.', 'success');
      fetchData();
    } catch (err) {
      console.error('Error archiving department:', err);
      showToast('Failed to archive department.', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const formatted = (status || '').replace('_', ' ').toUpperCase();
    switch (status) {
      case 'resolved':
      case 'closed':
      case 'Active':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">{formatted}</span>;
      case 'reported':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">{formatted}</span>;
      case 'Disabled':
      case 'Archived':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-500/20 text-rose-450 rounded-full border border-rose-500/30">{formatted}</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">{formatted}</span>;
    }
  };

  const getRoleBadge = (role: string) => {
    const label = role.replace('_', ' ').toUpperCase();
    if (role === 'administrator' || role === 'municipal_admin') {
      return <span className="px-2 py-0.5 text-[9px] font-black bg-violet-500/20 text-violet-400 rounded-full border border-violet-500/30">{label}</span>;
    }
    if (role === 'department_officer') {
      return <span className="px-2 py-0.5 text-[9px] font-black bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">OFFICER</span>;
    }
    return <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-400 rounded-full border border-slate-700">CITIZEN</span>;
  };

  return (
    <div className="space-y-8">
      {/* Secondary Sub-Navigation */}
      <div className="flex border-b border-slate-850 gap-6">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'overview' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <Map className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'analytics' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics & AI Insights
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'users' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <Users className="h-4 w-4" />
          User Accounts
        </button>
        <button
          onClick={() => setActiveSubTab('officers')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'officers' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Officers
        </button>
        <button
          onClick={() => setActiveSubTab('departments')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'departments' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <Building className="h-4 w-4" />
          Departments
        </button>
      </div>

      {/* ────────────────── SUB TAB: OVERVIEW (OPERATIONAL WORKSPACE) ────────────────── */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Headline Banner */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2">
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">Operational Command Console</h1>
              <p className="text-[11px] text-slate-500">Live smart city triage, map operations, and officer dispatch tracking</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={onRefresh}
                className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-350 cursor-pointer transition-all"
              >
                Refresh Data
              </button>
            </div>
          </div>

          {/* Home KPIs Grid - 8 indicators (Task 5) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block">Total Reports</span>
              <strong className="text-lg font-black text-white mt-1 block font-mono">{totalIssues}</strong>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Active Triage</span>
              <strong className="text-lg font-black text-amber-400 mt-1 block font-mono">{pendingIssues}</strong>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Critical</span>
              <strong className="text-lg font-black text-rose-500 mt-1 block font-mono">{criticalIssues}</strong>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Resolved Today</span>
              <strong className="text-lg font-black text-emerald-400 mt-1 block font-mono">{resolvedIssuesToday}</strong>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Pending Verif</span>
              <strong className="text-lg font-black text-blue-400 mt-1 block font-mono">{pendingVerification}</strong>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Staff Available</span>
              <strong className="text-lg font-black text-teal-400 mt-1 block font-mono">{officersAvailable}</strong>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Avg SLA</span>
              <strong className="text-lg font-black text-white mt-1 block font-mono">{avgResolutionTime}d</strong>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Satisfaction</span>
              <strong className="text-lg font-black text-emerald-400 mt-1 block font-mono">{citizenSatisfaction}%</strong>
            </div>
          </div>

          {/* Primary Operations Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Side: Map & Queue */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Map Panel */}
              <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-3xl backdrop-blur-sm space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Map className="h-4 w-4 text-emerald-400" />
                    City Operations Map
                  </h3>
                  <span className="text-[9px] font-mono text-slate-500">Live Pins ({filteredQueueIssues.length})</span>
                </div>
                <div className="h-[420px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative z-10">
                  <LeafletMapContainer
                    issues={filteredQueueIssues}
                    selectedLocation={
                      selectedIssue 
                        ? { lat: selectedIssue.latitude || 23.0225, lng: selectedIssue.longitude || 72.5714 }
                        : null
                    }
                    onLocationSelected={() => {}}
                    onMarkerClick={(issue) => {
                      setSelectedIssueId(issue.id);
                      setTargetDept(issue.department || '');
                      setTargetOfficerId(issue.officer_id || '');
                      setTargetCategory(issue.category || '');
                      setTargetPriority(issue.priority || '');
                      setTargetSeverity(issue.severity || 'low');
                      setTargetEscalated(!!issue.escalated);
                      setTargetDeadline(issue.deadline || issue.estimated_completion_date || '');
                      setTargetInternalNotes(issue.internal_notes || '');
                    }}
                  />
                </div>
              </div>

              {/* Triage Queue List */}
              <div className="p-5 bg-slate-900/40 border border-slate-800/80 rounded-3xl backdrop-blur-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Complaint Queue</h3>
                    <p className="text-[10px] text-slate-500">Triage incoming civilian reports</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-950 border border-slate-800 text-slate-400 font-mono">
                    {filteredQueueIssues.length} Matches
                  </span>
                </div>

                {/* Queue Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Search keywords..."
                    value={complaintSearch}
                    onChange={(e) => setComplaintSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <select
                    value={complaintDeptFilter}
                    onChange={(e) => setComplaintDeptFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-355 focus:outline-none"
                  >
                    <option value="">All Sectors</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.departmentName || d.name}</option>
                    ))}
                  </select>
                  <select
                    value={complaintPriorityFilter}
                    onChange={(e) => setComplaintPriorityFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-355 focus:outline-none"
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select
                    value={complaintStatusFilter}
                    onChange={(e) => setComplaintStatusFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-355 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="reported">Reported</option>
                    <option value="assigned">Assigned</option>
                    <option value="citizen_verification_pending">Pending Verification</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* Queue Items */}
                <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1.5 scrollbar-thin">
                  {filteredQueueIssues.length === 0 ? (
                    <div className="text-center py-10 text-slate-555 italic text-[11px]">
                      No complaints found in the active dispatch queue.
                    </div>
                  ) : (
                    filteredQueueIssues.map(issue => {
                      const isSelected = selectedIssueId === issue.id;
                      return (
                        <div
                          key={issue.id}
                          onClick={() => {
                            setSelectedIssueId(issue.id);
                            setTargetDept(issue.department || '');
                            setTargetOfficerId(issue.officer_id || '');
                            setTargetCategory(issue.category || '');
                            setTargetPriority(issue.priority || '');
                            setTargetSeverity(issue.severity || 'low');
                            setTargetEscalated(!!issue.escalated);
                            setTargetDeadline(issue.deadline || issue.estimated_completion_date || '');
                            setTargetInternalNotes(issue.internal_notes || '');
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                            isSelected 
                              ? 'bg-slate-800/40 border-emerald-500/50 shadow-lg shadow-emerald-500/5' 
                              : 'bg-slate-950/20 border-slate-800/60 hover:bg-slate-900/20'
                          }`}
                        >
                          <div className="space-y-1 max-w-md">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] text-slate-500">#{issue.id.slice(-6).toUpperCase()}</span>
                              {getStatusBadge(issue.status)}
                              {issue.priority === 'critical' && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-widest animate-pulse">Critical</span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-white leading-snug">{issue.title}</h4>
                            <p className="text-[10px] text-slate-500 truncate max-w-sm">{issue.address}</p>
                          </div>
                          
                          <div className="text-right shrink-0 flex md:flex-col gap-2 items-center md:items-end text-[9px] text-slate-500">
                            <span className="capitalize bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded font-mono">
                              Sector: {issue.category || 'Other'}
                            </span>
                            <span className="font-mono">
                              {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Right Side: rich Details & triage Panel (Task 4, 8, 9) */}
            <div className="lg:col-span-5">
              {selectedIssue ? (
                <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-3xl backdrop-blur-sm space-y-5">
                  
                  {/* Title Header */}
                  <div>
                    <span className="text-[9px] font-mono text-slate-550 uppercase tracking-widest block">Incident Profile #{selectedIssue.id.slice(-6).toUpperCase()}</span>
                    <h2 className="text-base font-black text-white mt-1 leading-snug">{selectedIssue.title}</h2>
                    <div className="flex gap-2 mt-2">
                      {getStatusBadge(selectedIssue.status)}
                      {selectedIssue.priority && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-950 border border-slate-800 text-slate-350 capitalize">
                          Priority: {selectedIssue.priority}
                        </span>
                      )}
                      {selectedIssue.escalated && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase">
                          Escalated
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description & Media (Task 4) */}
                  <div className="space-y-2 border-t border-slate-850 pt-4">
                    <p className="text-xs text-slate-350 leading-relaxed">{selectedIssue.description}</p>
                    {selectedIssue.address && (
                      <p className="text-[10px] text-slate-550 font-mono">📍 {selectedIssue.address}</p>
                    )}
                    {selectedIssue.citizenId && (
                      <p className="text-[9px] text-slate-500">Reported by Citizen: <span className="text-slate-350 font-mono font-bold">{selectedIssue.citizenId}</span></p>
                    )}
                    
                    {/* Attachment Image Preview */}
                    {selectedIssue.publicImageUrl && (
                      <div className="mt-3">
                        <span className="text-[8px] font-bold text-slate-550 uppercase tracking-wider block mb-1.5">Evidence Media Attachment</span>
                        <div className="h-28 w-44 rounded-xl border border-slate-805 overflow-hidden bg-slate-950">
                          <img 
                            src={selectedIssue.publicImageUrl} 
                            alt="Incident Evidence" 
                            className="h-full w-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                            onClick={() => window.open(selectedIssue.publicImageUrl || '', '_blank')}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 🤖 AI Dispatch Recommendation (Task 9) */}
                  <div className="p-4 bg-[#110e2b]/50 border border-violet-900/20 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                        <BrainCircuit className="h-4 w-4 text-violet-400 animate-pulse" />
                        AI Dispatch Audit
                      </span>
                      {selectedIssue.aiConfidence && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[8px] font-black border border-violet-500/20 font-mono">
                          {Math.round(selectedIssue.aiConfidence * 100)}% Confidence
                        </span>
                      )}
                    </div>
                    
                    {selectedIssue.aiSummary ? (
                      <p className="text-[10px] text-violet-200/90 leading-relaxed font-semibold italic">
                        "{selectedIssue.aiSummary}"
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">
                        Gemini classification analysis completed successfully. Override parameters recommended below.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-[9px] text-slate-400 pt-3 border-t border-violet-900/20">
                      <div>
                        <span className="text-slate-550 block font-bold uppercase text-[7px] tracking-wider mb-0.5">Suggested Sector</span>
                        <strong className="text-slate-200 capitalize">{selectedIssue.category || 'Other'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-550 block font-bold uppercase text-[7px] tracking-wider mb-0.5">Priority Override</span>
                        <strong className="text-slate-200 capitalize">{selectedIssue.priority || 'Medium'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-550 block font-bold uppercase text-[7px] tracking-wider mb-0.5">Est. Resolution SLA</span>
                        <strong className="text-emerald-400 font-mono">
                          {selectedIssue.priority === 'critical' ? '24 - 48 Hours' : selectedIssue.priority === 'high' ? '48 - 72 Hours' : '3 - 5 Days'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-550 block font-bold uppercase text-[7px] tracking-wider mb-0.5">Risk Factor</span>
                        <strong className={selectedIssue.priority === 'critical' || selectedIssue.priority === 'high' ? 'text-rose-450 font-bold' : 'text-slate-200'}>
                          {selectedIssue.priority === 'critical' ? 'CRITICAL RISK' : selectedIssue.priority === 'high' ? 'HIGH RISK' : 'STABLE'}
                        </strong>
                      </div>
                    </div>
                    
                    {recommendedOfficer && (
                      <div className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-[9px] text-slate-400 mt-2 flex justify-between items-center">
                        <div>
                          <span className="text-slate-500 block text-[7px] font-bold uppercase mb-0.5">Recommended Officer (Lowest Workload)</span>
                          <strong className="text-slate-200">{recommendedOfficer.fullName}</strong>
                          <span className="block text-[8px] text-slate-500">{recommendedOfficer.designation} ({recommendedOfficer.currentWorkload} active cases)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTargetOfficerId(recommendedOfficer.uid || recommendedOfficer.id)}
                          className="px-2 py-1 bg-violet-650 hover:bg-violet-600 text-white rounded text-[8px] font-bold cursor-pointer transition-colors"
                        >
                          Auto-Select
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Overrides Form Triage Area (Task 4) */}
                  <form onSubmit={handleSaveOverrides} className="space-y-4 border-t border-slate-850 pt-4">
                    <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Dispatch Override Control</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Department */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
                        <select
                          value={targetDept}
                          onChange={(e) => setTargetDept(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Choose Dept --</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.departmentName || d.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Officer */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Officer Assignment</label>
                        <select
                          value={targetOfficerId}
                          onChange={(e) => setTargetOfficerId(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Choose Officer --</option>
                          {officers.map(o => (
                            <option key={o.uid || o.id} value={o.uid || o.id}>
                              {o.fullName} ({o.department.toUpperCase()})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Category */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                        <select
                          value={targetCategory}
                          onChange={(e) => setTargetCategory(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Choose Category --</option>
                          <option value="roads">Roads & Potholes</option>
                          <option value="sanitation">Sanitation & Garbage</option>
                          <option value="electrical">Electrical & Streetlights</option>
                          <option value="water">Water & Leaks</option>
                          <option value="sewer">Sewerage</option>
                          <option value="garden">Gardens & Parks</option>
                          <option value="civil">Civil Structure</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Priority */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                        <select
                          value={targetPriority}
                          onChange={(e) => setTargetPriority(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Choose Priority --</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>

                      {/* Severity */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Severity</label>
                        <select
                          value={targetSeverity}
                          onChange={(e) => setTargetSeverity(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>

                      {/* Resolution SLA Deadline */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">SLA Deadline</label>
                        <input
                          type="date"
                          value={targetDeadline}
                          onChange={(e) => setTargetDeadline(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Escalate Toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={targetEscalated}
                        onChange={(e) => setTargetEscalated(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-semibold text-slate-300">
                        Escalate incident (Marks critical and dispatches emergency alert notification)
                      </span>
                    </label>

                    {/* Internal Notes */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Internal Administrative Dispatcher Notes</label>
                      <textarea
                        value={targetInternalNotes}
                        onChange={(e) => setTargetInternalNotes(e.target.value)}
                        placeholder="Add internal logs for officers..."
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 min-h-[50px] resize-none"
                      />
                    </div>

                    {/* Triage action triggers */}
                    <div className="flex gap-2 pt-2">
                      {selectedIssue.status !== 'resolved' && selectedIssue.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={handleCloseComplaint}
                          disabled={isSubmitting}
                          className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-450 text-[10px] font-bold rounded-xl cursor-pointer transition-colors"
                        >
                          Resolve Issue
                        </button>
                      )}
                      
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:bg-slate-850 disabled:text-slate-550"
                      >
                        {isSubmitting ? 'Applying Details...' : 'Apply Dispatch Overrides'}
                      </button>
                    </div>

                  </form>

                  {/* Operations Timeline Status Tracking (Task 8) */}
                  <div className="space-y-2.5 border-t border-slate-850 pt-4">
                    <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wider block">Complaint Timeline & Auditing Logs</span>
                    
                    <div className="space-y-3.5 relative pl-4 border-l border-slate-800 ml-1">
                      <div className="relative text-[10px]">
                        <span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                        <strong className="text-white block">Citizen Reported</strong>
                        <span className="text-slate-500 text-[9px]">Logged into system via Citizen Mobile App Portal</span>
                      </div>
                      
                      {selectedIssue.officer_id && (
                        <div className="relative text-[10px]">
                          <span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-slate-900" />
                          <strong className="text-white block">Dispatched & Assigned</strong>
                          <span className="text-slate-500 text-[9px]">Assigned to: {selectedIssue.officer_name || 'Officer'}</span>
                        </div>
                      )}
                      
                      {(selectedIssue.status === 'resolved' || selectedIssue.status === 'closed') && (
                        <div className="relative text-[10px]">
                          <span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-ping" />
                          <strong className="text-emerald-450 block font-bold">Closed & Resolved</strong>
                          <span className="text-slate-500 text-[9px]">Remediation verified by dispatcher</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="h-full min-h-[450px] flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-900/10 border border-slate-800/40 backdrop-blur-sm text-center text-slate-555">
                  <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                    <Activity className="h-5 w-5 text-emerald-500/70" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Awaiting Dispatch Select</h3>
                  <p className="text-[10px] text-slate-555 max-w-[280px] mt-1 leading-relaxed">
                    Select any complaint pin on the operations map or select from the queue list to review detailed AI insights and override officer routing.
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ────────────────── SUB TAB: ANALYTICS & AI INSIGHTS ────────────────── */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-8 animate-fadeIn">

          {/* Detailed Performance Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block">Reopened Cases</span>
              <strong className="text-xl font-black text-indigo-405 mt-1 block font-mono">{reopenedIssues}</strong>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block">Escalated Tickets</span>
              <strong className="text-xl font-black text-orange-400 mt-1 block font-mono">{escalatedIssues}</strong>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block">AI Classification Accuracy</span>
              <strong className="text-xl font-black text-violet-400 mt-1 block font-mono">{aiAccuracyRate}%</strong>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block">SLA Compliance Rate</span>
              <strong className="text-xl font-black text-emerald-400 mt-1 block font-mono">{slaCompliance}%</strong>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block">Avg Staff Load</span>
              <strong className="text-xl font-black text-white mt-1 block font-mono">{avgOfficerWorkload}</strong>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block">Online Sectors</span>
              <strong className="text-xl font-black text-teal-400 mt-1 block font-mono">{departmentsOnline}</strong>
            </div>
          </div>
          
          {/* Executive Alerts Banner (Module 8) */}
          {executiveAlerts.length > 0 && (
            <div className="p-4 bg-slate-900/60 border border-rose-500/30 rounded-2xl backdrop-blur-sm space-y-2">
              <div className="flex items-center gap-2 text-rose-450 font-extrabold text-xs uppercase tracking-wider">
                <ShieldAlert className="h-4 w-4 text-rose-500 animate-pulse" />
                Live Command Center Alerts
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-32 overflow-y-auto pr-1">
                {executiveAlerts.map(alert => (
                  <div key={alert.id} className="flex gap-2 p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-[10px]">
                    <span className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                      alert.type === 'error' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'
                    }`} />
                    <div>
                      <strong className="text-slate-200 block">{alert.title}</strong>
                      <span className="text-slate-400 leading-normal">{alert.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Executive Command Panel (Module 3 & 9) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                    <BrainCircuit className="h-4 w-4 text-violet-400" />
                    🤖 AI Executive Insights
                  </h3>
                  <p className="text-[10px] text-slate-500">Live operational advice from Gemini 2.5 Flash</p>
                </div>
                <button
                  onClick={handleGenerateInsights}
                  disabled={isGeneratingInsights}
                  className="px-3.5 py-1.5 bg-violet-650 hover:bg-violet-600 disabled:bg-slate-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-violet-500/10"
                >
                  {isGeneratingInsights ? 'Generating...' : 'Refresh Insights'}
                </button>
              </div>

              {aiInsights.length === 0 ? (
                <p className="text-xs text-slate-555 italic py-4">Click "Refresh Insights" to evaluate live dashboard metrics.</p>
              ) : (
                <ul className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {aiInsights.map((insight, idx) => (
                    <li key={idx} className="text-[10px] text-slate-350 p-2.5 bg-slate-950/30 border border-slate-850 rounded-xl leading-normal">
                      ✦ {insight}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    📈 Predictive Municipal Analytics
                  </h3>
                  <p className="text-[10px] text-slate-500">Monsoon trends & backlog forecasting</p>
                </div>
                <button
                  onClick={handleGeneratePredictions}
                  disabled={isGeneratingPredictions}
                  className="px-3.5 py-1.5 bg-emerald-550 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 text-[10px] font-black rounded-xl transition-all cursor-pointer shadow-lg"
                >
                  {isGeneratingPredictions ? 'Analyzing...' : 'Generate Predictions'}
                </button>
              </div>

              {!aiPredictions ? (
                <p className="text-xs text-slate-555 italic py-4">Click "Generate Predictions" to analyze historical workload trends.</p>
              ) : aiPredictions.insufficient ? (
                <div className="p-3.5 bg-slate-950/30 border border-slate-855 rounded-xl text-center">
                  <span className="text-[11px] font-semibold text-slate-400">{aiPredictions.message}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-[10px] max-h-[180px] overflow-y-auto pr-1">
                  <div className="bg-slate-950/30 border border-slate-850 p-3 rounded-xl">
                    <span className="text-slate-500 font-bold block uppercase text-[8px] mb-0.5">Expected Complaints Next Week</span>
                    <strong className="text-sm text-white font-mono mt-0.5 block">{aiPredictions.expected_complaints_next_week} reports</strong>
                  </div>
                  <div className="bg-slate-950/30 border border-slate-850 p-3 rounded-xl">
                    <span className="text-slate-500 font-bold block uppercase text-[8px] mb-0.5">Backlog Clearance ETA</span>
                    <strong className="text-sm text-emerald-400 font-mono mt-0.5 block">{aiPredictions.resolution_backlog_eta}</strong>
                  </div>
                  <div className="bg-slate-950/30 border border-slate-850 p-3 rounded-xl col-span-2">
                    <span className="text-slate-500 font-bold block uppercase text-[8px] mb-0.5">Predicted Workload Forecast</span>
                    <p className="text-slate-355 leading-relaxed">{aiPredictions.predicted_department_workload}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail & Rank Workspaces */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Top Performing Officers Card */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-emerald-400" />
                Top Performing Municipal Officers
              </h3>
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {topOfficers.map(o => (
                  <div key={o.uid || o.id} className="text-[10px] p-3 bg-slate-950/20 border border-slate-850 rounded-xl flex justify-between items-center">
                    <div>
                      <strong className="text-slate-200 block">{o.fullName}</strong>
                      <span className="text-slate-500 capitalize">{o.designation} • {o.department}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-bold block">{o.performanceScore}% Score</span>
                      <span className="text-slate-500 block text-[9px]">{o.currentWorkload} active tickets</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Administrative Audit Trail Log */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-400" />
                Administrative Audit Trail Log
              </h3>
              {activities.length === 0 ? (
                <p className="text-xs text-slate-555 text-center py-6">No administrative audit events logged.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {activities.map(act => (
                    <div key={act.id} className="text-[10px] p-3 bg-slate-950/20 border border-slate-850 rounded-xl flex justify-between items-start gap-4">
                      <div>
                        <strong className="text-slate-200 block">{act.action}</strong>
                        <span className="text-slate-450 leading-relaxed block mt-0.5">{act.adminName} modified {act.targetType} target #{act.targetId.slice(-6).toUpperCase()}</span>
                      </div>
                      <span className="text-[8px] text-slate-500 font-mono shrink-0">
                        {act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Custom SVG Executive Analytics Charts (Module 2) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Category Donut Distribution */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  Category Distribution
                </h4>
                <p className="text-[10px] text-slate-500">Live complaint breakdowns by category</p>
              </div>

              <div className="flex items-center justify-center py-4">
                <svg width="150" height="150" viewBox="0 0 150 150" className="transform -rotate-90">
                  <circle cx="75" cy="75" r="50" fill="transparent" stroke="#1e293b" strokeWidth="15" />
                  {/* Category proportions */}
                  {(() => {
                    const counts: Record<string, number> = {};
                    issues.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
                    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 3);
                    const totalVal = Object.values(counts).reduce((s,c) => s+c, 0) || 1;
                    
                    let accumulatedPercent = 0;
                    const colors = ['#10b981', '#3b82f6', '#f59e0b'];
                    
                    return sorted.map(([, val], idx) => {
                      const pct = (val / totalVal) * 100;
                      const circumference = 2 * Math.PI * 50;
                      const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                      accumulatedPercent += pct;
                      
                      return (
                        <circle
                          key={idx}
                          cx="75"
                          cy="75"
                          r="50"
                          fill="transparent"
                          stroke={colors[idx]}
                          strokeWidth="15"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    });
                  })()}
                </svg>
              </div>
              <div className="flex justify-around text-[9px] text-slate-455 border-t border-slate-800/40 pt-2 font-mono">
                <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> 1st</div>
                <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-blue-500" /> 2nd</div>
                <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-500" /> 3rd</div>
              </div>
            </div>

            {/* Department Resolution scorecard */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                Department Scorecard
              </h4>
              <p className="text-[10px] text-slate-500">Live workload & compliance rate comparison</p>
              <div className="space-y-3.5 max-h-[170px] overflow-y-auto pr-1">
                {sectorMetrics.map((dept) => (
                  <div key={dept.id} className="space-y-1">
                    <div className="flex justify-between text-[9px] font-semibold">
                      <span className="text-slate-400 capitalize">{dept.departmentName || dept.name}</span>
                      <span className="text-white font-mono">{dept.rate}% resolved ({dept.activeIssues} active)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                      <div 
                        style={{ width: `${dept.rate}%` }}
                        className="h-full rounded-full bg-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Confidence Trend Line Graph */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                  <BrainCircuit className="h-4 w-4 text-emerald-400" />
                  AI confidence trend
                </h4>
                <p className="text-[10px] text-slate-555">Confidence scores of recent routing</p>
              </div>

              <div className="h-28 w-full py-2">
                {(() => {
                  const recentConfidence = issues
                    .filter(i => i.aiConfidence)
                    .slice(0, 10)
                    .map(i => Math.round((i.aiConfidence || 0) * 100));
                  
                  if (recentConfidence.length < 2) {
                    return <p className="text-[10px] text-slate-500 italic text-center py-8">Awaiting audit metrics...</p>;
                  }

                  const points = recentConfidence.map((conf, idx) => {
                    const x = (idx / (recentConfidence.length - 1)) * 260 + 20;
                    const y = 90 - (conf / 100) * 70;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <svg viewBox="0 0 300 100" className="w-full h-full">
                      <path
                        d={`M ${points}`}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {recentConfidence.map((conf, idx) => {
                        const x = (idx / (recentConfidence.length - 1)) * 260 + 20;
                        const y = 90 - (conf / 100) * 70;
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r="4.5"
                            fill="#a78bfa"
                            stroke="#1e1b4b"
                            strokeWidth="1.5"
                          />
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
              <p className="text-[9px] text-slate-500 italic text-center border-t border-slate-800/40 pt-2 leading-relaxed">
                Gemini Vision dispatches are evaluated live. Accuracy threshold: 85% compliance.
              </p>
            </div>
          </div>

          {/* Pending Activations & Live Activity Feed (Module 7) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Live Activity Feed Panel */}
            <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-400" />
                Live Dispatch Activity Feed
              </h3>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No status log activities reported yet.</p>
              ) : (
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {notifications.map(notif => {
                    const formattedDate = notif.timestamp 
                      ? new Date(notif.timestamp.seconds * 1000 || notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div key={notif.id} className="text-[10px] p-3 bg-slate-950/20 border border-slate-850 rounded-xl flex justify-between items-start gap-4 hover:border-emerald-500/20 transition-all">
                        <div className="space-y-1">
                          <span className="text-slate-200 font-bold block">{notif.title}</span>
                          <p className="text-slate-400 leading-relaxed">{notif.message}</p>
                          {notif.issue_id && (
                            <span className="text-[8px] text-slate-500 block font-mono">Incident ID: #{notif.issue_id.slice(-6).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-[8px] text-slate-500 font-mono shrink-0">{formattedDate}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Officer Registrations */}
            <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-amber-400" />
                Pending Officers
              </h3>
              {pendingOfficers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No registrations pending.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {pendingOfficers.map(user => (
                    <div key={user.uid} className="flex justify-between items-center p-3 bg-slate-950/30 border border-slate-800 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-white block">{user.fullName}</span>
                        <span className="text-[9px] text-slate-450 block">{user.email}</span>
                      </div>
                      <button
                        onClick={() => handleToggleUserStatus(user)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[9px] rounded-lg cursor-pointer transition-colors"
                      >
                        Activate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ────────────────── SUB TAB: USER MANAGEMENT ────────────────── */}
      {activeSubTab === 'users' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filters Bar */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-850 backdrop-blur-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={userRoleFilter}
                onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-400 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Roles</option>
                <option value="citizen">Citizen</option>
                <option value="department_officer">Department Officer</option>
                <option value="administrator">Administrator</option>
              </select>
            </div>

            <select
              value={userStatusFilter}
              onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-400 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>

            <select
              value={userDeptFilter}
              onChange={(e) => { setUserDeptFilter(e.target.value); setUserPage(1); }}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-400 focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.departmentName || d.name}</option>
              ))}
            </select>
          </div>

          {/* User Data Table */}
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                    <th className="py-4 px-5">User</th>
                    <th className="py-4 px-5 cursor-pointer hover:text-white transition-colors" onClick={() => { setUserSortField('role'); setUserSortOrder(p=>p==='asc'?'desc':'asc'); }}>Role</th>
                    <th className="py-4 px-5">Department</th>
                    <th className="py-4 px-5">Designation</th>
                    <th className="py-4 px-5 cursor-pointer hover:text-white transition-colors" onClick={() => { setUserSortField('status'); setUserSortOrder(p=>p==='asc'?'desc':'asc'); }}>Status</th>
                    <th className="py-4 px-5">Created Date</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-355">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">No users found matching query filters.</td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-900/20 transition-all">
                        <td className="py-3.5 px-5 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Users className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{u.fullName}</span>
                            <span className="text-[10px] text-slate-500">{u.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">{getRoleBadge(u.role)}</td>
                        <td className="py-3.5 px-5 capitalize">{u.department || '—'}</td>
                        <td className="py-3.5 px-5 text-slate-400">{u.designation || '—'}</td>
                        <td className="py-3.5 px-5">{getStatusBadge(u.status)}</td>
                        <td className="py-3.5 px-5 font-mono text-[10px] text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`p-1.5 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer ${
                              u.status === 'Active' ? 'text-rose-400 hover:text-rose-350' : 'text-emerald-400 hover:text-emerald-355'
                            }`}
                            title={u.status === 'Active' ? 'Disable Account' : 'Enable Account'}
                          >
                            {u.status === 'Active' ? <UserX className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalUserPages > 1 && (
              <div className="px-5 py-4 bg-slate-950/40 border-t border-slate-855 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <span>Showing {paginatedUsers.length} of {filteredUsers.length} users</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    disabled={userPage === 1}
                    className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-white font-mono">Page {userPage} / {totalUserPages}</span>
                  <button
                    onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                    disabled={userPage === totalUserPages}
                    className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── SUB TAB: OFFICER MANAGEMENT ────────────────── */}
      {activeSubTab === 'officers' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Actions */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Officer Directory</h2>
              <p className="text-[10px] text-slate-500">Manage officer workloads, departments, and active ticket capacities</p>
            </div>
            <button
              onClick={() => setIsCreateOfficerOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-colors shadow-lg shadow-emerald-500/10"
            >
              <Plus className="h-4 w-4" />
              Provision Officer
            </button>
          </div>

          {/* Officers List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {officers.map((off) => {
              const officerId = off.uid || off.id;
              const officerIssues = issues.filter(i => i.officer_id === officerId || i.resolver_officer_name === off.fullName);

              // 1. Completed Today / This Week
              
              const resolvedIssuesList = officerIssues.filter(i => i.status === 'resolved' || i.status === 'closed');
              
              const completedToday = resolvedIssuesList.filter(i => {
                return i.resolution_date && new Date(i.resolution_date).toDateString() === todayStr;
              }).length;

              const completedThisWeek = resolvedIssuesList.filter(i => {
                return i.resolution_date && new Date(i.resolution_date) >= sevenDaysAgo;
              }).length;

              // 2. Average Citizen Rating
              const rated = officerIssues.filter(i => i.citizen_rating && i.citizen_rating > 0);
              const avgRating = rated.length > 0 
                ? (rated.reduce((s, i) => s + (i.citizen_rating || 0), 0) / rated.length).toFixed(1)
                : '4.5';

              // 3. SLA Compliance
              const compliant = officerIssues.filter(i => {
                const deadline = i.deadline || i.estimated_completion_date;
                if (!deadline) return true;
                return i.status === 'resolved' || i.status === 'closed'
                  ? (i.resolution_date ? new Date(i.resolution_date) : new Date()) <= new Date(deadline)
                  : new Date(deadline) >= new Date();
              });
              const slaRate = officerIssues.length > 0 ? Math.round((compliant.length / officerIssues.length) * 100) : 100;

              // 4. AI Recommendation
              let aiRecommendation = 'Generalist';
              const deptLower = (off.department || '').toLowerCase();
              if (deptLower.includes('water')) aiRecommendation = 'Water Resource Specialist';
              else if (deptLower.includes('road')) aiRecommendation = 'Asphalt & Pothole Expert';
              else if (deptLower.includes('electrical')) aiRecommendation = 'Grid Safety Engineer';
              else if (deptLower.includes('sanitation')) aiRecommendation = 'Hazardous Refuse Specialist';

              // 5. Resolution Accuracy
              const verifiedCompliant = resolvedIssuesList.filter(i => i.citizen_verified).length;
              const accuracyRate = resolvedIssuesList.length > 0
                ? Math.round((verifiedCompliant / resolvedIssuesList.length) * 100)
                : 95;

              // 6. Efficiency Score
              const efficiency = Math.round((off.performanceScore * 0.9) + (completedThisWeek * 2));

              return (
                <div key={officerId} className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{off.fullName}</h4>
                        <span className="text-[10px] text-slate-500 capitalize">{off.designation} • {off.department}</span>
                      </div>
                      {getStatusBadge(off.status)}
                    </div>

                    <div className="space-y-2 border-t border-b border-slate-850 py-3.5 text-[10px] text-slate-400">
                      <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-500" />{off.email}</div>
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-500" />{off.phone || 'No phone set'}</div>
                      <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-slate-500" />Joined: {off.joinedDate ? new Date(off.joinedDate).toLocaleDateString() : '—'}</div>
                    </div>

                    {/* Extended Workload and Performance stats */}
                    <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                      <div className="bg-slate-950/40 border border-slate-850 p-2 rounded-xl">
                        <span className="block text-[8px] text-slate-550 font-bold uppercase">Active Assignments</span>
                        <strong className="text-xs text-white font-mono">{off.currentWorkload} Tickets</strong>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-850 p-2 rounded-xl">
                        <span className="block text-[8px] text-slate-550 font-bold uppercase">Completed Today/Week</span>
                        <strong className="text-xs text-emerald-400 font-mono">{completedToday} / {completedThisWeek}</strong>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-850 p-2 rounded-xl">
                        <span className="block text-[8px] text-slate-550 font-bold uppercase">Avg Resolution Time</span>
                        <strong className="text-xs text-white font-mono">{off.averageResolutionTime}d</strong>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-850 p-2 rounded-xl">
                        <span className="block text-[8px] text-slate-550 font-bold uppercase">Citizen Satisfaction</span>
                        <strong className="text-xs text-emerald-400 font-mono">★ {avgRating} / 5.0</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-850/40">
                      <div className="flex justify-between">
                        <span>SLA compliance:</span>
                        <strong className="text-slate-300 font-mono">{slaRate}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Accuracy:</span>
                        <strong className="text-slate-300 font-mono">{accuracyRate}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Efficiency:</span>
                        <strong className="text-emerald-400 font-mono">{Math.min(efficiency, 100)}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Trend:</span>
                        <strong className="text-emerald-400 font-mono">↗ Upward</strong>
                      </div>
                    </div>

                    {/* AI Assignment recommendation */}
                    <div className="p-2.5 bg-violet-950/20 border border-violet-900/30 rounded-xl">
                      <span className="text-[8px] font-bold text-violet-400 block uppercase tracking-wider">🤖 AI Recommended Role Mapping</span>
                      <strong className="text-[10px] text-violet-200 mt-0.5 block">{aiRecommendation}</strong>
                    </div>

                    {/* Performance bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase">
                        <span>Performance Score</span>
                        <span className="text-emerald-400 font-mono">{off.performanceScore}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-900">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${off.performanceScore}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3.5 border-t border-slate-850 flex gap-2">
                    <button
                      onClick={() => handleOpenTransfer(off)}
                      className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white rounded-lg cursor-pointer transition-all"
                    >
                      Transfer / Edit
                    </button>
                    <button
                      onClick={() => handleDeactivateOfficer(off)}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                        off.status === 'Active'
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500/20'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {off.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────── SUB TAB: DEPARTMENT MANAGEMENT ────────────────── */}
      {activeSubTab === 'departments' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Actions */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Departments</h2>
              <p className="text-[10px] text-slate-500">Manage city administrative departments, assign heads, and track performance scores</p>
            </div>
            <button
              onClick={() => setIsCreateDeptOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-colors shadow-lg"
            >
              <Plus className="h-4 w-4" />
              Create Department
            </button>
          </div>

          {/* Department Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {departments.map((dept) => {
              const head = officers.find(o => o.uid === dept.headOfficer || o.id === dept.headOfficer);
              const deptId = dept.departmentId || dept.id;

              // Calculate department metrics dynamically
              const deptIssues = issues.filter(i => i.department === deptId);
              const pendingCount = deptIssues.filter(i => i.status === 'reported').length;
              const activeCount = deptIssues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length;
              const criticalCount = deptIssues.filter(i => i.severity === 'critical').length;
              
              const deptRated = deptIssues.filter(i => i.citizen_rating && i.citizen_rating > 0);
              const satisfaction = deptRated.length > 0
                ? Math.round((deptRated.reduce((s, i) => s + (i.citizen_rating || 0), 0) / deptRated.length / 5) * 100)
                : 90;

              const deptAi = deptIssues.filter(i => i.aiConfidence && i.aiConfidence > 0);
              const avgAi = deptAi.length > 0
                ? Math.round((deptAi.reduce((s, i) => s + (i.aiConfidence || 0), 0) / deptAi.length) * 100)
                : 85;

              const officerCount = officers.filter(o => o.department === deptId || (o.department || '').toLowerCase() === (dept.departmentName || '').toLowerCase()).length;
              const workloadFactor = officerCount > 0 ? (activeCount / officerCount).toFixed(1) : activeCount.toString();

              // SLA compliance for department
              const compliantIssues = deptIssues.filter(i => {
                const deadline = i.deadline || i.estimated_completion_date;
                if (!deadline) return true;
                return i.status === 'resolved' || i.status === 'closed'
                  ? (i.resolution_date ? new Date(i.resolution_date) : new Date()) <= new Date(deadline)
                  : new Date(deadline) >= new Date();
              });
              const slaRate = deptIssues.length > 0 ? Math.round((compliantIssues.length / deptIssues.length) * 100) : 100;

              return (
                <div key={deptId} className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-base font-black text-white">{dept.departmentName || dept.name}</h4>
                        <span className="text-[9px] font-mono text-slate-500 block uppercase mt-0.5">ID: {deptId}</span>
                      </div>
                      {getStatusBadge(dept.status)}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{dept.description}</p>

                    <div className="grid grid-cols-3 gap-3 border-t border-b border-slate-850 py-4 text-[10px] text-slate-450">
                      <div>
                        <span className="text-slate-600 font-bold block uppercase text-[8px] tracking-wider mb-1">Assigned Head</span>
                        <strong className="text-white text-xs block truncate">{head ? head.fullName : 'Not Appointed'}</strong>
                        <span className="block text-[8px] text-slate-500 truncate">{head ? head.designation : '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 font-bold block uppercase text-[8px] tracking-wider mb-1">Staff Capacity</span>
                        <strong className="text-white text-xs block font-mono">{officerCount} Officers</strong>
                        <span className="text-slate-500 font-mono text-[9px] block">{workloadFactor} active/off</span>
                      </div>
                      <div>
                        <span className="text-slate-600 font-bold block uppercase text-[8px] tracking-wider mb-1">Ticket Load</span>
                        <span className="text-slate-300 font-mono block"><strong className="text-white">{activeCount}</strong> active</span>
                        <span className="text-rose-500 font-mono text-[8px] block">{criticalCount} critical • {pendingCount} pending</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500">
                      <div className="flex justify-between">
                        <span>Avg Resolution:</span>
                        <strong className="text-slate-300 font-mono">{dept.averageResolutionTime || 2.4}d</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>SLA Compliance:</span>
                        <strong className="text-emerald-400 font-mono">{slaRate}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Citizen Satisfaction:</span>
                        <strong className="text-emerald-400 font-mono">{satisfaction}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>AI confidence:</span>
                        <strong className="text-violet-400 font-mono">{avgAi}%</strong>
                      </div>
                      <div className="flex justify-between col-span-2 text-[9px] italic border-t border-slate-850/40 pt-1.5 mt-0.5">
                        <span>Weekly Trend:</span>
                        <span className="text-emerald-400 font-bold font-mono">↘ Stable Workload</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-855 flex gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenEditDept(dept)}
                      className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-350 hover:text-white rounded-lg cursor-pointer transition-all"
                    >
                      Nominate Head / Edit
                    </button>
                    {dept.status === 'Active' && (
                      <button
                        onClick={() => handleArchiveDept(dept)}
                        className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-450 text-[10px] font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: EDIT USER DETAILS ────────────────── */}
      {isEditingUser && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Modify Account Profile</h3>
              <button onClick={() => { setIsEditingUser(false); setSelectedUser(null); }} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="flex gap-4 items-center pb-4 border-b border-slate-850">
                <div className="h-12 w-12 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-6 w-6 text-slate-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{selectedUser.fullName}</h4>
                  <span className="text-[10px] text-slate-500 block">{selectedUser.email}</span>
                  <span className="text-[8px] font-mono text-slate-550 block">UID: {selectedUser.uid}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editUserFullName}
                    onChange={(e) => setEditUserFullName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Role</label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 focus:outline-none"
                  >
                    <option value="citizen">Citizen</option>
                    <option value="department_officer">Department Officer</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Status</label>
                  <select
                    value={editUserStatus}
                    onChange={(e) => setEditUserStatus(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                {editUserRole === 'department_officer' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign Department</label>
                      <select
                        required
                        value={editUserDept}
                        onChange={(e) => setEditUserDept(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-455 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Choose Dept --</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.departmentName || d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Officer Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Pothole Surveyor"
                        required
                        value={editUserDesignation}
                        onChange={(e) => setEditUserDesignation(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Password Action */}
              <div className="pt-4 border-t border-slate-850 flex justify-between items-center text-[10px]">
                <button
                  type="button"
                  onClick={handleResetPasswordSimulated}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
                >
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  Generate Reset Password Email
                </button>
              </div>

              <div className="pt-4 border-t border-slate-850 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsEditingUser(false); setSelectedUser(null); }}
                  className="flex-1 py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer disabled:bg-slate-850 disabled:text-slate-555 text-center"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: PROVISION NEW OFFICER ────────────────── */}
      {isCreateOfficerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="h-4.5 w-4.5 text-emerald-450" />
                Provision Municipal Officer
              </h3>
              <button onClick={() => setIsCreateOfficerOpen(false)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateOfficer} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Officer Amit Patel"
                    required
                    value={newOfficerName}
                    onChange={(e) => setNewOfficerName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    placeholder="amit.roads@hero.gov.in"
                    required
                    value={newOfficerEmail}
                    onChange={(e) => setNewOfficerEmail(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temporal Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={newOfficerPassword}
                    onChange={(e) => setNewOfficerPassword(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43211"
                    required
                    value={newOfficerPhone}
                    onChange={(e) => setNewOfficerPhone(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Department</label>
                  <select
                    required
                    value={newOfficerDept}
                    onChange={(e) => setNewOfficerDept(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-455 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Dept --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.departmentName || d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Designation / Role Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Roads Inspector"
                    required
                    value={newOfficerDesignation}
                    onChange={(e) => setNewOfficerDesignation(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-855 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOfficerOpen(false)}
                  className="flex-1 py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer disabled:bg-slate-850 disabled:text-slate-555 text-center"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: TRANSFER OFFICER ────────────────── */}
      {isTransferOfficerOpen && selectedOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Transfer / Edit Officer</h3>
              <button onClick={() => { setIsTransferOfficerOpen(false); setSelectedOfficer(null); }} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleTransferOfficer} className="p-6 space-y-4">
              <div>
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Active Target</span>
                <h4 className="text-xs font-bold text-white mt-0.5">{selectedOfficer.fullName}</h4>
                <span className="text-[10px] text-slate-500 block capitalize">{selectedOfficer.designation} • {selectedOfficer.department} Department</span>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-850">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transfer to Department</label>
                  <select
                    required
                    value={transferDept}
                    onChange={(e) => setTransferDept(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-455 focus:outline-none focus:border-emerald-500"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.departmentName || d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Designation</label>
                  <input
                    type="text"
                    required
                    value={transferDesignation}
                    onChange={(e) => setTransferDesignation(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsTransferOfficerOpen(false); setSelectedOfficer(null); }}
                  className="flex-1 py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-450 hover:text-white rounded-xl transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer disabled:bg-slate-850 disabled:text-slate-550 text-center"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: CREATE DEPARTMENT ────────────────── */}
      {isCreateDeptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Building className="h-4.5 w-4.5 text-emerald-455" />
                Create Municipal Sector
              </h3>
              <button onClick={() => setIsCreateDeptOpen(false)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateDept} className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department Identifier ID</label>
                  <input
                    type="text"
                    placeholder="e.g. sewage_management"
                    required
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                  <p className="text-[9px] text-slate-505">Lowercase letters and underscores only. No spaces.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sewage & Drainage"
                    required
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sector Description</label>
                  <textarea
                    placeholder="Provide overview of duties..."
                    rows={3}
                    required
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateDeptOpen(false)}
                  className="flex-1 py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-450 hover:text-white rounded-xl transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer disabled:bg-slate-850 disabled:text-slate-550 text-center"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: EDIT DEPARTMENT ────────────────── */}
      {isEditDeptOpen && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Edit Department</h3>
              <button onClick={() => { setIsEditDeptOpen(false); setSelectedDept(null); }} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateDept} className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department Name</label>
                  <input
                    type="text"
                    required
                    value={editDeptName}
                    onChange={(e) => setEditDeptName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sector Description</label>
                  <textarea
                    rows={3}
                    required
                    value={editDeptDesc}
                    onChange={(e) => setEditDeptDesc(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appoint Department Head</label>
                  <select
                    value={editDeptHead}
                    onChange={(e) => setEditDeptHead(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 focus:outline-none"
                  >
                    <option value="">-- Appoint Head --</option>
                    {officers
                      .filter(o => o.department === (selectedDept.departmentId || selectedDept.id) && o.status === 'Active')
                      .map(o => (
                        <option key={o.uid || o.id} value={o.uid || o.id}>{o.fullName}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsEditDeptOpen(false); setSelectedDept(null); }}
                  className="flex-1 py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-450 hover:text-white rounded-xl transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer disabled:bg-slate-850 disabled:text-slate-550 text-center"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
