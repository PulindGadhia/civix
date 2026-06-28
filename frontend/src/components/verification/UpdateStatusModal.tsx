/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Loader2, Upload, AlertCircle } from 'lucide-react';
import { showToast } from '../../utils/toast';

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  currentStatus: string;
  currentDepartment: string;
  apiBaseUrl: string;
  onSuccess: (newStatus: string) => void;
}

export function UpdateStatusModal({
  isOpen,
  onClose,
  issueId,
  currentStatus,
  currentDepartment,
  apiBaseUrl,
  onSuccess
}: UpdateStatusModalProps) {
  const [statusVal, setStatusVal] = useState(currentStatus);
  const [updatedBy, setUpdatedBy] = useState('Officer Watson');
  const [notes, setNotes] = useState('');
  const [department, setDepartment] = useState(currentDepartment || '');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 2 Progressive Lifecycle Form State
  const [technicianName, setTechnicianName] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [materialUsed, setMaterialUsed] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStatusVal(currentStatus);
      setDepartment(currentDepartment || '');
      setNotes('');
      setError(null);
      setSelectedFiles([]);
      setEstimatedCost('');
      setEstimatedCompletionDate('');
      setTechnicianName('');
      setInspectionDate('');
      setMaterialUsed('');
    }
  }, [isOpen, currentStatus, currentDepartment]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('status', statusVal);
    formData.append('updated_by', updatedBy);
    formData.append('notes', notes);
    if (department) formData.append('department', department);
    if (estimatedCompletionDate) formData.append('estimated_completion_date', estimatedCompletionDate);
    if (estimatedCost) formData.append('estimated_cost', estimatedCost);
    if (technicianName) formData.append('technician_name', technicianName);
    if (inspectionDate) formData.append('inspection_date', inspectionDate);
    if (materialUsed) formData.append('material_used', materialUsed);
    
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(
        `${apiBaseUrl}/api/v1/issues/${issueId}/status`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        showToast(`Issue status updated to ${statusVal.replace(/_/g, ' ').toUpperCase()}`, 'success');
        onSuccess(statusVal);
        onClose();
      }
    } catch (err) {
      console.error('Error updating status:', err);
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || 'Failed to update issue lifecycle status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statuses = [
    { value: 'reported', label: 'Reported' },
    { value: 'ai_analysis_completed', label: 'AI Analysis Completed' },
    { value: 'pending_administrator_review', label: 'Pending Admin Review' },
    { value: 'department_assigned', label: 'Department Assigned' },
    { value: 'officer_assigned', label: 'Officer Assigned' },
    { value: 'officer_accepted', label: 'Officer Accepted' },
    { value: 'officer_rejected', label: 'Officer Rejected' },
    { value: 'inspection_scheduled', label: 'Inspection Scheduled' },
    { value: 'inspection_completed', label: 'Inspection Completed' },
    { value: 'work_in_progress', label: 'Work In Progress' },
    { value: 'repair_completed', label: 'Repair Completed' },
    { value: 'citizen_verification_pending', label: 'Citizen Verification Pending' },
    { value: 'citizen_rejected', label: 'Citizen Rejected' },
    { value: 'reopened', label: 'Reopened' },
    { value: 'closed', label: 'Closed' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800/60">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Update Lifecycle Status</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-450 rounded-xl text-[11px] font-semibold flex gap-2 items-start">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Status Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Status</label>
            <select
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Officer Name */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Updated By (Officer Name)</label>
            <input
              type="text"
              value={updatedBy}
              onChange={(e) => setUpdatedBy(e.target.value)}
              placeholder="e.g. Officer Watson"
              className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Department Selection (visible when assigned) */}
          {(statusVal === 'department_assigned' || department) && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
                required={statusVal === 'department_assigned'}
              >
                <option value="">-- Select Department --</option>
                <option value="roads">Roads Department</option>
                <option value="sanitation">Sanitation</option>
                <option value="electrical">Electrical</option>
                <option value="water">Water Department</option>
                <option value="sewer">Sewer Department</option>
                <option value="garden">Garden Department</option>
                <option value="civil">Civil Department</option>
              </select>
            </div>
          )}

          {/* Inspection Date (visible when status is Inspection Scheduled) */}
          {statusVal === 'inspection_scheduled' && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Inspection Date</label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          )}

          {/* Technician Name (visible when status is WIP or other work stages) */}
          {['work_in_progress', 'repair_completed', 'resolved', 'citizen_verification_pending'].includes(statusVal) && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign Technician / Lead Worker</label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="e.g. Technician Robert"
                className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Estimated Completion Date (visible for relevant progressive statuses) */}
          {['department_assigned', 'officer_assigned', 'officer_accepted', 'inspection_scheduled', 'work_in_progress'].includes(statusVal) && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Completion Date</label>
              <input
                type="date"
                value={estimatedCompletionDate}
                onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Estimated Cost (optional for Repair Approved and Resolved) */}
          {['resolved', 'repair_completed', 'citizen_verification_pending'].includes(statusVal) && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Repair Cost ($)</label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Materials Used (visible for Resolved status) */}
          {['resolved', 'repair_completed', 'citizen_verification_pending'].includes(statusVal) && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Materials Used</label>
              <input
                type="text"
                value={materialUsed}
                onChange={(e) => setMaterialUsed(e.target.value)}
                placeholder="e.g. Asphalt mix, Concrete, Sealant"
                className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Status Notes */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {statusVal === 'resolved' ? 'Completion/Resolution Notes' : 'Status Transition Notes'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide status updates, notes regarding duplicates, repair schedule or closing reasons..."
              className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 min-h-[70px]"
              required={['resolved', 'closed', 'officer_rejected', 'citizen_rejected', 'reopened'].includes(statusVal)}
            />
          </div>

          {/* Optional Attachments / After Images */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {statusVal === 'resolved' ? 'Upload After Proof (Images/Videos)' : 'Attach Progress Proof'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:scale-[1.02] active:scale-[0.98] text-slate-350 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all duration-200"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                Select files
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                className="hidden"
              />
              <span className="text-[9px] text-slate-500">Supports images & videos</span>
            </div>

            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedFiles.map((file, idx) => (
                  <span key={idx} className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[9px] font-mono text-slate-400 truncate max-w-[150px]">
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-850 text-[11px] font-bold text-slate-350 hover:bg-slate-950 hover:text-white hover:scale-[1.02] active:scale-[0.98] cursor-pointer transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-black bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] text-slate-950 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:scale-100 shadow-lg shadow-emerald-500/5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
