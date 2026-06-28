import React, { useState, useRef } from 'react';
import { 
  X, 
  Camera, 
  Trash2, 
  Sparkles, 
  Play, 
  Cpu, 
  MapPin,
  Pencil 
} from 'lucide-react';
import axios from 'axios';
import { showToast } from '../../utils/toast';

interface AddressDetails {
  rawAddress: string;
  houseNumber: string;
  street: string;
  area: string;
  locality: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
}

interface IncidentReportFormProps {
  selectedLocation: { lat: number; lng: number } | null;
  addressDetails: AddressDetails | null;
  onCancel: () => void;
  onSubmitSuccess: () => void;
  apiBaseUrl: string;
}

// Client-Side Image Compression Helper
const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file); // Don't compress videos
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8 // 80% compression quality
          );
        } else {
          resolve(file);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const IncidentReportForm: React.FC<IncidentReportFormProps> = ({
  selectedLocation,
  addressDetails,
  onCancel,
  onSubmitSuccess,
  apiBaseUrl,
}) => {
  // Input fields initialized lazily from localStorage draft
  const [title, setTitle] = useState(() => {
    try {
      const saved = localStorage.getItem('community_hero_draft');
      return saved ? (JSON.parse(saved).title || '') : '';
    } catch {
      return '';
    }
  });

  const [description, setDescription] = useState(() => {
    try {
      const saved = localStorage.getItem('community_hero_draft');
      return saved ? (JSON.parse(saved).description || '') : '';
    } catch {
      return '';
    }
  });

  const [category, setCategory] = useState(() => {
    try {
      const saved = localStorage.getItem('community_hero_draft');
      return saved ? (JSON.parse(saved).category || 'Road Damage') : 'Road Damage';
    } catch {
      return 'Road Damage';
    }
  });
  
  // Media states
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ id: string; url: string; type: string; progress: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AI states
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isCategoryOverridden, setIsCategoryOverridden] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiResults, setAiResults] = useState<any>(null);
  const [aiNotes, setAiNotes] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<string>('');

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Editable Location states
  const [latVal, setLatVal] = useState(selectedLocation?.lat.toString() || '');
  const [lngVal, setLngVal] = useState(selectedLocation?.lng.toString() || '');
  const [addressVal, setAddressVal] = useState(addressDetails?.rawAddress || '');
  const [countryVal, setCountryVal] = useState(addressDetails?.country || '');
  const [stateVal, setStateVal] = useState(addressDetails?.state || '');
  const [districtVal, setDistrictVal] = useState(addressDetails?.district || '');
  const [cityVal, setCityVal] = useState(addressDetails?.city || '');
  const [localityVal, setLocalityVal] = useState(addressDetails?.locality || '');
  const [pincodeVal, setPincodeVal] = useState(addressDetails?.pincode || '');
  const [areaVal, setAreaVal] = useState(addressDetails?.area || '');
  const [streetVal, setStreetVal] = useState(addressDetails?.street || '');

  // User manual inputs
  const [houseNumberVal, setHouseNumberVal] = useState(addressDetails?.houseNumber || '');
  const [apartmentVal, setApartmentVal] = useState('');
  const [buildingNameVal, setBuildingNameVal] = useState('');
  const [floorVal, setFloorVal] = useState('');
  const [wingBlockVal, setWingBlockVal] = useState('');
  const [streetNumberVal, setStreetNumberVal] = useState('');
  const [landmarkVal, setLandmarkVal] = useState(addressDetails?.landmark || '');
  const [nearbyShopVal, setNearbyShopVal] = useState('');
  const [addressNotesVal, setAddressNotesVal] = useState('');
  const [specialDirectionsVal, setSpecialDirectionsVal] = useState('');

  // Sync effect when selectedLocation or addressDetails change (marker moves)
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (selectedLocation) {
      setLatVal(selectedLocation.lat.toString());
      setLngVal(selectedLocation.lng.toString());
    }
    if (addressDetails) {
      setAddressVal(addressDetails.rawAddress || '');
      setCountryVal(addressDetails.country || '');
      setStateVal(addressDetails.state || '');
      setDistrictVal(addressDetails.district || '');
      setCityVal(addressDetails.city || '');
      setLocalityVal(addressDetails.locality || '');
      setPincodeVal(addressDetails.pincode || '');
      setAreaVal(addressDetails.area || '');
      setStreetVal(addressDetails.street || '');

      // Preserve optional manual inputs by only filling them if they are currently empty
      if (!houseNumberVal && addressDetails.houseNumber) {
        setHouseNumberVal(addressDetails.houseNumber);
      }
      if (!landmarkVal && addressDetails.landmark) {
        setLandmarkVal(addressDetails.landmark);
      }
    }
  }, [selectedLocation, addressDetails]);

  // Cleanup AI results from session storage when component unmounts
  React.useEffect(() => {
    return () => {
      sessionStorage.removeItem('community_hero_ai_results');
    };
  }, []);

  const saveDraft = (newTitle: string, newDesc: string, newCat: string) => {
    localStorage.setItem(
      'community_hero_draft',
      JSON.stringify({ title: newTitle, description: newDesc, category: newCat })
    );
  };

  const clearDraft = () => {
    localStorage.removeItem('community_hero_draft');
    sessionStorage.removeItem('community_hero_ai_results');
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFiles = (files: FileList) => {
    const newFiles: File[] = [];
    const newPreviews: typeof filePreviews = [];

    Array.from(files).forEach((file) => {
      // Validate type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        alert(`File "${file.name}" is not a supported image or video.`);
        return;
      }

      // Validate size (max 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File "${file.name}" exceeds the 50MB upload limit.`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      const fileId = Math.random().toString(36).substring(2, 9);
      
      newFiles.push(file);
      newPreviews.push({
        id: fileId,
        url: previewUrl,
        type: isVideo ? 'video' : 'image',
        progress: 0,
      });

      // Simulate file upload progress
      let p = 0;
      const interval = setInterval(() => {
        p += 20;
        setFilePreviews((prev) => 
          prev.map((item) => item.id === fileId ? { ...item, progress: p } : item)
        );
        if (p >= 100) clearInterval(interval);
      }, 100);
    });

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const handleDeleteFile = (idx: number, id: string) => {
    URL.revokeObjectURL(filePreviews[idx].url);
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => prev.filter((item) => item.id !== id));
  };

  // Run Real Gemini API Vision Analysis
  const handleAiAnalysis = async () => {
    if (isAiProcessing) return;
    if (attachedFiles.length === 0 || !selectedLocation) return;

    setIsAiProcessing(true);
    setIsCategoryOverridden(false);
    setAiStep(0);
    setAiResults(null);
    setAiError(null);

    const startTime = performance.now();

    // Trigger progressive steps animation
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < 8) {
        currentStep++;
        setAiStep(currentStep);
      }
    }, 1200);

    try {
      // Step: Preparing Image (compression)
      setAiStep(1);
      const compressedFiles = await Promise.all(
        attachedFiles.map(file => compressImage(file))
      );

      // Step: Sending to Gemini
      setAiStep(2);
      const formData = new FormData();
      compressedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('latitude', latVal);
      formData.append('longitude', lngVal);
      formData.append('address', addressVal);
      if (aiNotes.trim()) {
        formData.append('notes', aiNotes);
      }

      const response = await axios.post(
        `${apiBaseUrl}/api/v1/ai/analyze`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      const data = response.data;

      // Backend signals AI is unavailable (quota / config error)
      if (data.success === false || data.aiAvailable === false) {
        clearInterval(interval);
        const errorMsg = data.error || 'AI analysis is temporarily unavailable.';
        setAiError(errorMsg);
        setIsAiProcessing(false);
        return;
      }

      // Automatically autofill complaint form if valid civic issue
      if (data.classification === 'Not a Civic Issue' || data.classification === 'Uncertain') {
        setTitle('');
        setDescription('');
        setCategory('Other');
        saveDraft('', '', 'Other');
      } else {
        const validCategories = [
          'Road Damage',
          'Water Leakage',
          'Garbage',
          'Streetlight',
          'Drainage',
          'Traffic Signal',
          'Illegal Dumping',
          'Public Infrastructure',
          'Other'
        ];
        const normalizedCategory = validCategories.find(
          (cat) => cat.toLowerCase() === (data.category || '').toLowerCase()
        ) || 'Other';

        setTitle(data.title || '');
        setDescription(data.description || '');
        setCategory(normalizedCategory);
        saveDraft(data.title || '', data.description || '', normalizedCategory);
      }

      const duration = ((performance.now() - startTime) / 1000).toFixed(1);
      setProcessingTime(`${duration}s`);

      // Fast forward to completed step
      clearInterval(interval);
      setAiStep(9); // Completed
      setAiResults(data);
      sessionStorage.setItem('community_hero_ai_results', JSON.stringify(data));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      clearInterval(interval);
      console.error("Gemini Vision AI analysis error:", err);
      const errorData = err.response?.data;
      // Prefer the structured backend error message
      const errorMsg =
        (errorData?.aiAvailable === false && errorData?.error) ||
        errorData?.details ||
        errorData?.detail ||
        errorData?.error ||
        err.message ||
        "Failed to contact AI service. Please try again.";
      setAiError(errorMsg);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!latVal || !lngVal || !title || !description) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('latitude', latVal);
    formData.append('longitude', lngVal);
    formData.append('address', addressVal);
    formData.append('category', category);
    
    // Add location breakdown fields
    formData.append('country', countryVal);
    formData.append('state', stateVal);
    formData.append('district', districtVal);
    formData.append('city', cityVal);
    formData.append('locality', localityVal);
    formData.append('pincode', pincodeVal);
    formData.append('houseNumber', houseNumberVal);
    formData.append('apartment', apartmentVal);
    formData.append('buildingName', buildingNameVal);
    formData.append('landmark', landmarkVal);
    formData.append('street', streetVal);
    formData.append('floor', floorVal);
    formData.append('wingBlock', wingBlockVal);
    formData.append('streetNumber', streetNumberVal);
    formData.append('nearbyShop', nearbyShopVal);
    formData.append('addressNotes', addressNotesVal);
    formData.append('specialDirections', specialDirectionsVal);

    // Append AI audit metadata if available
    if (aiResults) {
      if (aiResults.severity) {
        formData.append('severity', aiResults.severity.toLowerCase());
      }
      const priorityScores: Record<string, number> = { low: 10, medium: 45, high: 75, critical: 95 };
      const score = priorityScores[(aiResults.priority || '').toLowerCase()] || 10;
      formData.append('priorityScore', score.toString());
      if (aiResults.department) {
        formData.append('department', aiResults.department);
      }
      if (aiResults.confidence !== undefined) {
        formData.append('aiConfidence', aiResults.confidence.toString());
      }
      formData.append('aiAnalysis', JSON.stringify(aiResults));
    }
    
    // Attach first file for the database schema
    if (attachedFiles.length > 0) {
      formData.append('image', attachedFiles[0]);
    }

    try {
      const response = await axios.post(`${apiBaseUrl}/api/v1/issues`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearDraft();

      // Module 3 — Show duplicate complaint warning if detected
      const duplicateStatus = response.data?.duplicateStatus;
      if (duplicateStatus?.isDuplicate) {
        showToast(duplicateStatus.recommendation, 'warning');
      }

      onSubmitSuccess();
    } catch (error) {
      console.error('Failed to submit incident report:', error);
      alert('Network error. Failed to save report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit button validation
  const isValidCivicIssue = 
    !aiResults || 
    aiResults.classification === 'Civic Issue' || 
    isCategoryOverridden;

  const isSubmitDisabled = 
    isSubmitting || 
    !title.trim() || 
    !description.trim() || 
    !isValidCivicIssue ||
    !latVal.trim() ||
    !lngVal.trim() ||
    !addressVal.trim() ||
    !cityVal.trim() ||
    !stateVal.trim() ||
    !districtVal.trim() ||
    !countryVal.trim();

  const stepsList = [
    'Uploading Media...',
    'Preparing Image...',
    'Sending to Gemini...',
    'Analyzing Infrastructure...',
    'Detecting Civic Issue...',
    'Evaluating Severity...',
    'Finding Responsible Department...',
    'Generating Complaint...',
    'Preparing AI Report...',
    'Completed'
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800/60 bg-slate-950/30">
        <div>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-emerald-400" />
            Submit Incident Report
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">Citizens verification pipeline</p>
        </div>
        <button 
          onClick={onCancel}
          className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        
        {/* Step 1: Drag & Drop Media Loader */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Media Attachments (Photos / Videos)
          </label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-24 ${
              isDragActive 
                ? 'border-emerald-400 bg-emerald-500/5' 
                : 'border-slate-800 bg-slate-950/40 hover:bg-slate-950/80 hover:border-slate-700'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-6 w-6 text-slate-400 mb-2" />
            <p className="text-xs font-semibold text-slate-300">
              Drag & drop media files, or <span className="text-emerald-400">browse</span>
            </p>
            <p className="text-[9px] text-slate-500 mt-1">
              Supports JPG, PNG, WEBP, MP4, MOV (Max 50MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Previews List */}
          {filePreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {filePreviews.map((file, idx) => (
                <div key={file.id} className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-20 group">
                  {file.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400">
                      <Play className="h-5 w-5" />
                    </div>
                  ) : (
                    <img src={file.url} alt="Attachment" className="w-full h-full object-cover" />
                  )}
                  
                  {/* Upload Progress Overlay */}
                  {file.progress < 100 && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center px-2">
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full transition-all" style={{ width: `${file.progress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(idx, file.id);
                    }}
                    className="absolute top-1 right-1 p-1 bg-slate-950/80 rounded-md text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-950 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optional User Notes for AI Analysis */}
        <div className="space-y-1">
          <label htmlFor="ai-notes-field" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Optional Notes for AI Analysis
          </label>
          <input
            id="ai-notes-field"
            type="text"
            value={aiNotes}
            onChange={(e) => setAiNotes(e.target.value)}
            placeholder="e.g., Broken streetlight, water leaking from pipe..."
            className="w-full bg-slate-955/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-colors"
          />
        </div>

        {/* ✨ Analyze with Gemini Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleAiAnalysis}
            disabled={attachedFiles.length === 0 || isAiProcessing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 hover:from-violet-500 hover:to-teal-400 disabled:from-slate-800 disabled:to-slate-800 text-white text-xs font-black tracking-wider uppercase transition-all shadow-lg shadow-indigo-500/10 cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4.5 w-4.5" />
            ✨ Analyze with Gemini
          </button>
        </div>

        {/* Gemini Error State */}
        {aiError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-305 text-xs space-y-2">
            <p className="font-bold flex items-center gap-1">⚠ Gemini Analysis Failed</p>
            <p className="text-[11px] leading-relaxed">{aiError}</p>
            <button
              type="button"
              onClick={handleAiAnalysis}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Gemini processing loader overlay */}
        {isAiProcessing && (
          <div className="p-4.5 rounded-2xl bg-slate-950/80 border border-indigo-500/20 backdrop-blur-sm animate-pulse space-y-3">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 animate-spin" />
              Gemini Vision AI Inspection Pipeline
            </p>
            <div className="space-y-1.5">
              {stepsList.map((stepName, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    aiStep > idx 
                      ? 'bg-emerald-500' 
                      : aiStep === idx 
                      ? 'bg-indigo-400 animate-ping' 
                      : 'bg-slate-800'
                  }`} />
                  <span className={aiStep === idx ? 'text-white font-bold' : 'text-slate-500'}>
                    {stepName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Display AI assessment scorecard (AI Result Card) */}
        {aiResults && !isAiProcessing && (
          <>
            {/* Case 1: Not a Civic Issue */}
            {aiResults.classification === 'Not a Civic Issue' && (
              <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2.5 shadow-md">
                <p className="font-bold flex items-center gap-1.5 text-rose-400">
                  <span className="text-rose-500">⚠</span> Image Classification: Not a Civic Issue
                </p>
                <p className="text-[11px] leading-relaxed text-slate-350">
                  This image does not appear to contain a reportable civic issue. Please upload an image related to roads, public infrastructure, waste management, drainage, street lighting, or another community problem.
                </p>
                {aiResults.reason && (
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-900/60 text-[10px] text-slate-405">
                    <span className="font-bold text-slate-300 block mb-0.5">Reason:</span>
                    {aiResults.reason}
                  </div>
                )}
                {aiResults.suggestion && (
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-900/60 text-[10px] text-slate-405">
                    <span className="font-bold text-slate-300 block mb-0.5">Suggestion:</span>
                    {aiResults.suggestion}
                  </div>
                )}
              </div>
            )}

            {/* Case 2: Uncertain */}
            {aiResults.classification === 'Uncertain' && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2.5 shadow-md">
                <p className="font-bold flex items-center gap-1.5 text-amber-400">
                  <span className="text-amber-500">⚠</span> Image Classification: Uncertain
                </p>
                <p className="text-[11px] leading-relaxed text-slate-350">
                  The AI is uncertain whether a reportable public infrastructure or community issue is visible in this image. Manual verification is required.
                </p>
                {aiResults.reason && (
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-900/60 text-[10px] text-slate-405">
                    <span className="font-bold text-slate-300 block mb-0.5">Reason for Uncertainty:</span>
                    {aiResults.reason}
                  </div>
                )}
                {aiResults.suggestion && (
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-900/60 text-[10px] text-slate-405">
                    <span className="font-bold text-slate-300 block mb-0.5">Recommendation:</span>
                    {aiResults.suggestion}
                  </div>
                )}
              </div>
            )}

            {/* Case 3: Civic Issue */}
            {aiResults.classification === 'Civic Issue' && (
              <>
                {aiResults.confidence < 0.60 && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1 shadow-md">
                    <p className="font-bold flex items-center gap-1.5">
                      <span className="text-amber-400">⚠</span> Manual Verification Recommended
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-305">
                      The AI confidence score is {typeof aiResults.confidence === 'number' ? `${(aiResults.confidence * 100).toFixed(1)}%` : 'low'}. Please review the fields below and verify them manually.
                    </p>
                  </div>
                )}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                    <h4 className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      Gemini Vision Audit Verdict
                    </h4>
                    <span className="text-[9px] font-mono text-slate-500">Processed in {processingTime}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-[10px]">
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Detected Issue</span>
                      <span className="text-white font-bold block">{aiResults.issue_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Confidence Score</span>
                      <span className="text-emerald-400 font-extrabold font-mono text-xs">
                        {typeof aiResults.confidence === 'number' 
                          ? `${(aiResults.confidence * 100).toFixed(1)}%` 
                          : aiResults.confidence || '94.8%'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Issue Category</span>
                      <span className="text-indigo-400 font-bold block capitalize">{aiResults.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Priority / Severity</span>
                      <span className={`font-bold block uppercase ${
                        aiResults.severity === 'critical' || aiResults.severity === 'high' ? 'text-rose-500' : 'text-amber-500'
                      }`}>
                        {aiResults.severity} (Priority: {aiResults.priority})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Routed Department</span>
                      <span className="text-slate-300 font-bold block">{aiResults.department}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Est. Resolution Time</span>
                      <span className="text-slate-300 font-mono font-bold block">{aiResults.estimated_resolution}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Hazard Level</span>
                      <span className="text-slate-300 font-bold block capitalize">{aiResults.hazard_level}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Possible Cause</span>
                      <span className="text-slate-400 block leading-tight">{aiResults.possible_cause}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Visible Damage Details</span>
                      <span className="text-slate-300 block leading-tight">{aiResults.visible_damage}</span>
                    </div>
                    {aiResults.recommended_action && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Resolution Recommendation</span>
                        <span className="text-slate-300 block leading-tight">{aiResults.recommended_action}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-900 text-[10px] space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/60">
                    <span className="text-rose-400 font-bold uppercase text-[8px] tracking-wider block">Citizen Safety Advice:</span>
                    <p className="text-slate-300 italic leading-relaxed">{aiResults.safety_advice}</p>
                  </div>

                  <div className="pt-2 text-[9px] text-slate-500 space-y-0.5">
                    <span className="block font-bold text-slate-400">AI Structural Audit Report:</span>
                    <p className="text-slate-400 leading-normal bg-slate-950 p-2.5 rounded-lg border border-slate-900/60 font-medium">
                      <span className="font-bold text-white block mb-1">Title: {aiResults.title}</span>
                      {aiResults.summary}
                    </p>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Input Details */}
        <div className="space-y-4">
          <div>
            <label htmlFor="title-field" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Title
            </label>
            <input
              id="title-field"
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                saveDraft(e.target.value, description, category);
              }}
              placeholder="e.g., Pothole obstructing lane"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[9px] text-slate-500 mt-1 block text-right">
              {title.length}/100 characters
            </span>
          </div>

          <div>
            <label htmlFor="description-field" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              id="description-field"
              required
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                saveDraft(title, e.target.value, category);
              }}
              placeholder="Provide exact details of structural hazard..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[9px] text-slate-500 mt-1 block text-right">
              {description.length}/1000 characters
            </span>
          </div>

          <div>
            <label htmlFor="category-field" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              id="category-field"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                saveDraft(title, description, e.target.value);
                setIsCategoryOverridden(true);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Road Damage">Road Damage</option>
              <option value="Water Leakage">Water Leakage</option>
              <option value="Garbage">Garbage / Waste</option>
              <option value="Streetlight">Streetlight</option>
              <option value="Drainage">Drainage</option>
              <option value="Traffic Signal">Traffic Signal</option>
              <option value="Illegal Dumping">Illegal Dumping</option>
              <option value="Public Infrastructure">Public Infrastructure</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Geocoding Components Grid */}
        {selectedLocation && (
          <div className="pt-4 border-t border-slate-800/60 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-rose-500" />
              Geocoded Location Breakdown
            </h4>

            {/* Complete formatted address */}
            <div className="bg-slate-955/65 p-3 rounded-lg border border-slate-800 text-[10px] relative flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-500 block uppercase font-bold tracking-wider text-[8px]">Complete Address *</span>
                <Pencil className="h-2.5 w-2.5 text-slate-500" />
              </div>
              <textarea
                value={addressVal}
                onChange={(e) => setAddressVal(e.target.value)}
                rows={2}
                className="w-full bg-transparent border-none text-white font-semibold leading-relaxed text-[10px] focus:outline-none p-0 focus:ring-0 resize-none"
                placeholder="Complete Address (Required)"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              {/* Latitude */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Latitude *</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={latVal}
                  onChange={(e) => setLatVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold font-mono text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Latitude"
                />
              </div>

              {/* Longitude */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Longitude *</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={lngVal}
                  onChange={(e) => setLngVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold font-mono text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Longitude"
                />
              </div>

              {/* Country */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Country *</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={countryVal}
                  onChange={(e) => setCountryVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Country"
                />
              </div>

              {/* State */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">State *</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="State"
                />
              </div>

              {/* District */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">District *</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={districtVal}
                  onChange={(e) => setDistrictVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="District"
                />
              </div>

              {/* City/Town */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">City/Town *</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={cityVal}
                  onChange={(e) => setCityVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="City/Town"
                />
              </div>

              {/* House/Plot */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">House/Plot</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={houseNumberVal}
                  onChange={(e) => setHouseNumberVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="House/Plot number"
                />
              </div>

              {/* Apartment/Flat */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Apartment/Flat</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={apartmentVal}
                  onChange={(e) => setApartmentVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Apt/Flat No."
                />
              </div>

              {/* Building Name */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Building Name</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={buildingNameVal}
                  onChange={(e) => setBuildingNameVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Building Name"
                />
              </div>

              {/* Floor */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Floor</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={floorVal}
                  onChange={(e) => setFloorVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="e.g. 3rd"
                />
              </div>

              {/* Wing/Block */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Wing/Block</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={wingBlockVal}
                  onChange={(e) => setWingBlockVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="e.g. Block B"
                />
              </div>

              {/* Street Number */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Street Number</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={streetNumberVal}
                  onChange={(e) => setStreetNumberVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Street Number"
                />
              </div>

              {/* Street/Route */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Street/Route</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={streetVal}
                  onChange={(e) => setStreetVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Street/Route"
                />
              </div>

              {/* Local Area */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Local Area</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={areaVal}
                  onChange={(e) => setAreaVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Local Area"
                />
              </div>

              {/* Locality */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Locality</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={localityVal}
                  onChange={(e) => setLocalityVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Locality"
                />
              </div>

              {/* Landmark */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Landmark</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={landmarkVal}
                  onChange={(e) => setLandmarkVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Landmark"
                />
              </div>

              {/* Nearby Shop / Building */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Nearby Shop/Bldg</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={nearbyShopVal}
                  onChange={(e) => setNearbyShopVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Nearby Shop/Building"
                />
              </div>

              {/* Postal Pin Code */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Postal Pin Code</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={pincodeVal}
                  onChange={(e) => setPincodeVal(e.target.value)}
                  className="w-full bg-transparent border-none text-white font-semibold font-mono text-[10px] focus:outline-none p-0 focus:ring-0"
                  placeholder="Postal Code"
                />
              </div>

              {/* Additional Address Notes */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Additional Address Notes</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <textarea
                  value={addressNotesVal}
                  onChange={(e) => setAddressNotesVal(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0 resize-none"
                  placeholder="Optional notes e.g. door code, buzzer..."
                />
              </div>

              {/* Special Directions */}
              <div className="bg-slate-955/65 p-2 rounded-lg border border-slate-800 relative flex flex-col col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Special Directions</span>
                  <Pencil className="h-2.5 w-2.5 text-slate-500" />
                </div>
                <textarea
                  value={specialDirectionsVal}
                  onChange={(e) => setSpecialDirectionsVal(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent border-none text-white font-semibold text-[10px] focus:outline-none p-0 focus:ring-0 resize-none"
                  placeholder="Optional directions e.g. take a left after the park..."
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Submit footer */}
      <div className="p-6 border-t border-slate-800/60 bg-slate-950/30 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-slate-800 text-xs font-bold hover:bg-slate-850 hover:text-white transition-colors cursor-pointer text-center text-slate-400"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          className="flex-1 py-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition-colors shadow-lg cursor-pointer flex items-center justify-center"
        >
          {isSubmitting ? 'Filing Report...' : 'File Report (+50 XP)'}
        </button>
      </div>
    </div>
  );
};
