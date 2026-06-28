import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Languages, 
  User,
  Copy,
  Check,
  RotateCcw,
  StopCircle,
  Sparkles
} from 'lucide-react';
import axios from 'axios';

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

import type { Issue } from '../../App';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  attachmentUrl?: string | null;
  timestamp: string;
}

interface FloatingAssistantProps {
  apiBaseUrl: string;
  selectedLocation?: { lat: number; lng: number } | null;
  addressDetails?: AddressDetails | null;
  isReporting?: boolean;
  activeIssue?: Issue | null;
  currentUser: { uid: string; role: string; name: string; department?: string };
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const FloatingAssistant: React.FC<FloatingAssistantProps> = ({ 
  apiBaseUrl,
  selectedLocation = null,
  addressDetails = null,
  isReporting = false,
  activeIssue = null,
  currentUser
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');

  // Dynamically set welcome message based on persona role
  useEffect(() => {
    let welcomeText = 'Hello! I am your AI Civic Assistant. How can I help you improve your neighborhood today? I support English, हिन्दी (Hindi), and ગુજરાતી (Gujarati).';
    if (currentUser.role === 'department_officer') {
      welcomeText = `Welcome back, Officer ${currentUser.name}. I am your Operational Assistant. How can I help you manage your tasks, inspect repairs, or check schedules today?`;
    } else if (currentUser.role === 'administrator') {
      welcomeText = `Welcome back, Administrator ${currentUser.name}. I am your Executive Analytics Assistant. How can I help you audit municipal performance, monitor Firestore records, or reassign issues today?`;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: welcomeText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [currentUser]);
  const [chatLanguage, setChatLanguage] = useState<'en' | 'hi' | 'gu'>('en');
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll chat log
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Handle Speech Recognition (Web Speech API)
  const handleSpeechInput = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = chatLanguage === 'hi' ? 'hi-IN' : chatLanguage === 'gu' ? 'gu-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const speechText = event.results[0][0].transcript;
      setUserInput(speechText);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setIsSending(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = textToSend || userInput;
    if (!messageText.trim() && !attachedImage) return;

    if (isGenerating) {
      handleStopGenerating();
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessageId = generateId();

    let base64Image: string | null = null;
    let imageMimeType: string | null = null;
    let localPreviewUrl: string | null = null;

    if (attachedImage) {
      imageMimeType = attachedImage.type;
      localPreviewUrl = imagePreview;
      try {
        base64Image = await fileToBase64(attachedImage);
      } catch (err) {
        console.error('Failed to convert image to base64:', err);
      }
    }

    const newUserMessage: Message = {
      id: userMessageId,
      sender: 'user',
      text: messageText,
      attachmentUrl: localPreviewUrl,
      timestamp
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setUserInput('');
    setAttachedImage(null);
    setImagePreview(null);
    setIsSending(true);
    setIsGenerating(true);

    // Read draft and AI analysis results from storage
    let draftReport = null;
    try {
      const savedDraft = localStorage.getItem('community_hero_draft');
      if (savedDraft) draftReport = JSON.parse(savedDraft);
    } catch (e) {
      console.error('Error parsing draft from localStorage:', e);
    }

    let aiAnalysis = null;
    try {
      const savedAi = sessionStorage.getItem('community_hero_ai_results');
      if (savedAi) aiAnalysis = JSON.parse(savedAi);
    } catch (e) {
      console.error('Error parsing AI results from sessionStorage:', e);
    }

    const contextPayload = {
      currentPage: isReporting ? 'Reporting Form' : activeIssue ? 'Issue Details' : 'Dashboard Map',
      location: selectedLocation ? {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        address: addressDetails?.rawAddress,
        city: addressDetails?.city,
        district: addressDetails?.district,
        state: addressDetails?.state,
        country: addressDetails?.country,
      } : null,
      aiAnalysis: aiAnalysis ? {
        title: aiAnalysis.title,
        description: aiAnalysis.description,
        category: aiAnalysis.category,
        confidence: aiAnalysis.confidence,
        severity: aiAnalysis.severity,
        department: aiAnalysis.department,
        classification: aiAnalysis.classification,
      } : null,
      draftReport: draftReport ? {
        title: draftReport.title,
        description: draftReport.description,
        category: draftReport.category,
      } : null,
      activeIssue: activeIssue ? {
        id: activeIssue.id,
        title: activeIssue.title,
        description: activeIssue.description,
        category: activeIssue.category,
        severity: activeIssue.severity,
        status: activeIssue.status,
      } : null,
    };

    const historyPayload = messages
      .filter((msg) => msg.id !== 'welcome')
      .map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        text: msg.text,
      }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': (axios.defaults.headers.common['Authorization'] as string) || '',
        },
        body: JSON.stringify({
          message: messageText,
          preferred_language: chatLanguage,
          history: historyPayload,
          context: contextPayload,
          image: base64Image,
          image_mime_type: imageMimeType,
          stream: true
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Readable stream not supported');
      }

      setIsSending(false); // Stop thinking spinner, start streaming content card

      const assistantMessageId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          sender: 'assistant',
          text: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      const decoder = new TextDecoder();
      let done = false;
      const accumulatedChunks: string[] = [];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          accumulatedChunks.push(chunk);
          const currentText = accumulatedChunks.join('');
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, text: currentText } : msg
            )
          );
        }
      }
    } catch (err) {
      const errorObj = err as { name?: string };
      if (errorObj && errorObj.name === 'AbortError') {
        console.log('Generation aborted by user.');
        return;
      }
      console.error('Chat generation error:', err);
      // Auto retry once with stream=false
      try {
        const retryResponse = await axios.post(`${apiBaseUrl}/api/v1/chat`, {
          message: messageText,
          preferred_language: chatLanguage,
          history: historyPayload,
          context: contextPayload,
          image: base64Image,
          image_mime_type: imageMimeType,
          stream: false
        }, {
          signal: controller.signal
        });

        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            sender: 'assistant',
            text: retryResponse.data.response,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            sender: 'assistant',
            text: 'I encountered an issue generating a response. Please check your connection and click the Regenerate button to try again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } finally {
      setIsSending(false);
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleRetry = () => {
    const userMessages = messages.filter((msg) => msg.sender === 'user');
    if (userMessages.length > 0) {
      const lastUserMsg = userMessages[userMessages.length - 1];
      setMessages((prev) => {
        const lastUserIdx = prev.findLastIndex((msg) => msg.id === lastUserMsg.id);
        return prev.slice(0, lastUserIdx);
      });
      handleSend(lastUserMsg.text);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatMessageText = (text: string) => {
    if (!text) return '';

    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; lang?: string; content: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const plainText = text.substring(lastIndex, match.index);
      if (plainText) {
        parts.push({ type: 'text', content: plainText });
      }
      parts.push({ type: 'code', lang: match[1], content: match[2] });
      lastIndex = codeBlockRegex.lastIndex;
    }
    
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }

    return parts.map((part, index) => {
      if (part.type === 'code') {
        return (
          <pre key={index} className="bg-slate-950 p-2 rounded-lg border border-slate-900 text-[9px] font-mono text-emerald-400 overflow-x-auto my-1 max-w-full">
            {part.lang && <div className="text-[7px] text-slate-500 uppercase font-bold mb-0.5">{part.lang}</div>}
            <code>{part.content}</code>
          </pre>
        );
      }

      let htmlContent = part.content || '';
      
      // Bold
      htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      htmlContent = htmlContent.replace(/`(.*?)`/g, '<code class="bg-slate-950 px-1 py-0.5 rounded text-rose-400 font-mono text-[9px]">$1</code>');
      // Clickable links
      htmlContent = htmlContent.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:underline font-semibold">$1</a>');
      
      // Bullet lists
      const lines = htmlContent.split('\n');
      let inList = false;
      const processedLines: string[] = [];
      
      lines.forEach((line) => {
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          if (!inList) {
            processedLines.push('<ul class="list-disc pl-4 space-y-0.5 my-1">');
            inList = true;
          }
          processedLines.push(`<li>${line.trim().substring(2)}</li>`);
        } else {
          if (inList) {
            processedLines.push('</ul>');
            inList = false;
          }
          processedLines.push(line);
        }
      });
      if (inList) {
        processedLines.push('</ul>');
      }
      
      return (
        <div 
          key={index} 
          className="whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: processedLines.join('\n') }}
        />
      );
    });
  };

  const getQuickPrompts = () => {
    if (currentUser.role === 'citizen') {
      return [
        { text: 'Report a pothole' },
        { text: 'How does AI work?' },
        { text: 'Track my complaint' },
        { text: 'Explain severity' },
        { text: 'What are Civic Points?' },
        { text: 'How are departments assigned?' }
      ];
    } else if (currentUser.role === 'department_officer') {
      return [
        { text: "Show today's pending inspections." },
        { text: 'How do I update issue status?' },
        { text: 'What is my current workload?' },
        { text: 'Explain average resolution time' },
        { text: 'How do I upload after images?' },
        { text: 'Assign a technician to a task' }
      ];
    } else {
      return [
        { text: 'Which department has the highest pending complaints?' },
        { text: 'Show city overview analytics summary.' },
        { text: 'Check Firestore connection status.' },
        { text: 'List available Gemini models.' },
        { text: 'Audit officer workloads.' },
        { text: 'How do I reassign an issue?' }
      ];
    }
  };

  const quickPrompts = getQuickPrompts();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      
      {/* Floating Chat Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-tr from-violet-600 via-indigo-600 to-teal-500 hover:from-violet-500 hover:to-teal-400 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-all animate-bounce cursor-pointer"
        >
          <Bot className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] h-[480px] rounded-3xl border border-slate-800 bg-slate-950/95 backdrop-blur-xl shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-up">
          
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-4 border-b border-slate-900 bg-slate-900/30">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Bot className="h-4.5 w-4.5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                  {currentUser.role === 'citizen' ? 'CiviX AI' : currentUser.role === 'department_officer' ? 'Officer Assistant AI' : 'Executive Assistant AI'}
                </h4>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] text-slate-500 font-mono">Gemini AI Active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Language Selector */}
              <div className="flex items-center gap-1 border border-slate-900 bg-slate-950 rounded-lg p-1">
                <Languages className="h-3 w-3 text-slate-400" />
                <select
                  value={chatLanguage}
                  onChange={(e) => setChatLanguage(e.target.value as 'en' | 'hi' | 'gu')}
                  className="bg-transparent border-0 text-[9px] font-bold text-slate-300 focus:outline-none focus:ring-0 cursor-pointer"
                >
                  <option value="en">EN</option>
                  <option value="hi">HI</option>
                  <option value="gu">GU</option>
                </select>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-900 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center border text-[10px] ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div className="max-w-[75%] space-y-1">
                  <div className={`px-4 py-2.5 rounded-2xl text-[11px] leading-relaxed relative group ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900 text-slate-350 rounded-tl-none border border-slate-900'
                  }`}>
                    {msg.sender === 'user' ? (
                      msg.text
                    ) : (
                      <div className="space-y-1">
                        {formatMessageText(msg.text)}
                      </div>
                    )}
                  </div>
                  
                  {msg.attachmentUrl && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 h-20 max-w-[120px] bg-slate-900">
                      <img src={msg.attachmentUrl} alt="Chat Attachment" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Copy & Regenerate Actions under Assistant Messages */}
                  {msg.sender === 'assistant' && msg.id !== 'welcome' && (
                    <div className="flex items-center gap-2 pl-1 mt-0.5">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="text-slate-500 hover:text-slate-300 flex items-center gap-0.5 cursor-pointer text-[9px] font-medium transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-2.5 w-2.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      {msg.id === messages[messages.length - 1].id && !isGenerating && (
                        <button
                          onClick={handleRetry}
                          className="text-slate-500 hover:text-slate-300 flex items-center gap-0.5 cursor-pointer text-[9px] font-medium transition-colors"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                          <span>Regenerate</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <span className="text-[8px] text-slate-600 block text-right px-1 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Thinking / Typing Loader */}
            {isSending && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="px-4 py-2.5 rounded-2xl text-[11px] leading-relaxed bg-slate-900 text-slate-400 rounded-tl-none border border-slate-900 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          {messages.length === 1 && (
            <div className="px-5 py-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt.text)}
                  className="px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-800 hover:border-emerald-500/30 text-[9px] font-semibold text-slate-400 hover:text-emerald-400 transition-all cursor-pointer text-left flex items-center gap-1"
                >
                  <Sparkles className="h-2.5 w-2.5 text-emerald-400/80" />
                  {prompt.text}
                </button>
              ))}
            </div>
          )}

          {/* Streaming Stop Indicator Panel */}
          {isGenerating && (
            <div className="flex justify-center py-1">
              <button
                onClick={handleStopGenerating}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Stop Generating
              </button>
            </div>
          )}

          {/* Input Panel */}
          <div className="p-4 border-t border-slate-900 bg-slate-950">
            {imagePreview && (
              <div className="relative inline-block mb-2 rounded-lg overflow-hidden border border-slate-800 h-10 w-10 bg-slate-900">
                <img src={imagePreview} alt="Attached preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setAttachedImage(null);
                    setImagePreview(null);
                  }}
                  className="absolute inset-0 bg-slate-950/60 flex items-center justify-center text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex gap-2 items-center">
              {/* Media clip */}
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-2 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="Attach photo"
              >
                <Paperclip className="h-4 w-4" />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageAttach}
                  className="hidden"
                />
              </button>

              {/* Voice button */}
              <button
                onClick={handleSpeechInput}
                className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                  isListening 
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' 
                    : 'bg-slate-900 border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Dictate message"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              {/* Text input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask assistant..."
                  className="w-full bg-slate-900 border border-slate-850 focus:border-emerald-500 text-white rounded-xl py-2 pl-3 pr-10 text-xs focus:outline-none"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isSending || isGenerating || (!userInput.trim() && !attachedImage)}
                  className="absolute right-1.5 top-1.5 p-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg disabled:bg-slate-800 disabled:text-slate-600 transition-colors cursor-pointer"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
