import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';

interface SearchFilterBarProps {
  onFilterChange: (filters: {
    category?: string;
    status?: string;
    department?: string;
    priority?: string;
    severity?: string;
    city?: string;
    searchQuery?: string;
  }) => void;
  onReset: () => void;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  onFilterChange,
  onReset
}) => {
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [severity, setSeverity] = React.useState('');
  const [city, setCity] = React.useState('');

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      searchQuery: search || undefined,
      category: category || undefined,
      status: status || undefined,
      department: department || undefined,
      severity: severity || undefined,
      city: city || undefined,
    });
  };

  const handleClear = () => {
    setSearch('');
    setCategory('');
    setStatus('');
    setDepartment('');
    setSeverity('');
    setCity('');
    onReset();
  };

  return (
    <form onSubmit={handleApply} className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports by title, description..."
            className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
        </div>

        {/* City Input */}
        <div className="w-full md:w-48 relative">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter by city..."
            className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl py-3 pl-4 pr-4 text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between pt-1">
        <div className="flex flex-wrap gap-2.5">
          {/* Category */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-[11px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-bold focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="Road Damage">Road Damage</option>
            <option value="Water Leakage">Water Leakage</option>
            <option value="Garbage">Garbage</option>
            <option value="Streetlight">Streetlight</option>
            <option value="Drainage">Drainage</option>
            <option value="Traffic Signal">Traffic Signal</option>
            <option value="Illegal Dumping">Illegal Dumping</option>
            <option value="Public Infrastructure">Public Infrastructure</option>
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-[11px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-bold focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="ai_analysis_completed">AI Analysis Completed</option>
            <option value="community_verification">Community Verification</option>
            <option value="department_assigned">Department Assigned</option>
            <option value="inspection_scheduled">Inspection Scheduled</option>
            <option value="investigation_started">Investigation Started</option>
            <option value="repair_approved">Repair Approved</option>
            <option value="work_in_progress">Work In Progress</option>
            <option value="repair_completed">Repair Completed</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          {/* Department */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="text-[11px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-bold focus:outline-none"
          >
            <option value="">All Departments</option>
            <option value="roads">Roads Department</option>
            <option value="sanitation">Sanitation</option>
            <option value="electrical">Electrical</option>
            <option value="water">Water Department</option>
            <option value="sewer">Sewer Department</option>
            <option value="garden">Garden Department</option>
            <option value="civil">Civil Department</option>
          </select>

          {/* Severity */}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="text-[11px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-bold focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-[10px] font-black cursor-pointer transition-all"
          >
            <Filter className="h-3 w-3" />
            Apply Filters
          </button>
        </div>
      </div>
    </form>
  );
};
