
import React, { useState, useEffect, useMemo } from 'react';
import { FilmSettings, FilmPreset, DEFAULT_SETTINGS, AiLogItem } from '../types';
import { generateSettingsFromPrompt, editImageWithNanoBanana, analyzeImageForSuggestions } from '../services/geminiService';
import { Histogram } from './Histogram';
import { DevelopState, AiState } from '../App';
import { ProcessingOverlay } from './ProcessingOverlay';
import { authService } from '../services/authService';

interface FilmControlsProps {
  // Develop Props
  settings: FilmSettings;
  developLogs: AiLogItem[];
  onDevelopChange: (state: DevelopState) => void;
  
  undoSettings: () => void;
  redoSettings: () => void;
  canUndoSettings: boolean;
  canRedoSettings: boolean;

  // AI Props
  currentImage: string | null;
  aiLogs: AiLogItem[];
  onAiChange: (state: AiState) => void;
  
  originalUpload: string | null; 
  undoImage: () => void;
  redoImage: () => void;
  canUndoImage: boolean;
  canRedoImage: boolean;

  clearFutureImageHistory: () => void;
  comparePos: number;
  currentUser: any; // Passed from App
}

const DEFAULT_AI_FEATURES = ["Vintage 1950s", "Cyberpunk Neon", "Oil Painting", "Charcoal Sketch"];
const DEFAULT_AI_ATMOSPHERE = ["Golden Hour", "Snowing", "Rainy Night", "Foggy Morning"];

const VIGNETTE_COLORS = [
  { color: '#000000', label: 'Black' },
  { color: '#ffffff', label: 'White' },
  { color: '#3e2723', label: 'Sepia' },
  { color: '#0d47a1', label: 'Navy' },
  { color: '#b71c1c', label: 'Burn' }
];

interface CustomPreset {
  name: string;
  settings: FilmSettings;
}

export const FilmControls: React.FC<FilmControlsProps> = ({ 
  settings, developLogs, onDevelopChange,
  undoSettings, redoSettings, canUndoSettings, canRedoSettings,
  currentImage, aiLogs, onAiChange,
  originalUpload,
  undoImage, redoImage, canUndoImage, canRedoImage,
  clearFutureImageHistory, comparePos, currentUser
}) => {
  const [magicPrompt, setMagicPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'develop' | 'ai'>('develop');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempEditText, setTempEditText] = useState('');
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');

  const [suggestedFeatures, setSuggestedFeatures] = useState<string[]>(DEFAULT_AI_FEATURES);
  const [suggestedAtmosphere, setSuggestedAtmosphere] = useState<string[]>(DEFAULT_AI_ATMOSPHERE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load Presets from Cloud/Local based on Auth
  useEffect(() => {
    const loadPresets = async () => {
       if (currentUser) {
           const data = await authService.getUserData(currentUser.uid, 'presets');
           if (data) setCustomPresets(data);
           else setCustomPresets([]);
       } else {
           // Fallback (shouldn't happen in authenticated app)
           const saved = localStorage.getItem('analog_presets');
           if (saved) try { setCustomPresets(JSON.parse(saved)); } catch(e){}
       }
    };
    loadPresets();
  }, [currentUser]);

  useEffect(() => {
    if(errorMessage) { const t = setTimeout(() => setErrorMessage(null), 5000); return () => clearTimeout(t); }
  }, [errorMessage]);

  const initiateSavePreset = () => {
    setNewRecipeName(`Saved Recipe ${customPresets.length + 1}`);
    setIsSavingRecipe(true);
  };

  const confirmSavePreset = async () => {
    if (newRecipeName.trim()) {
      const newPreset: CustomPreset = { name: newRecipeName, settings: { ...settings } };
      const updated = [...customPresets, newPreset];
      setCustomPresets(updated);
      setIsSavingRecipe(false);
      
      // Sync to Auth Service
      if (currentUser) {
         await authService.saveUserData(currentUser.uid, 'presets', updated);
      }
    }
  };

  const deletePreset = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm(`Delete recipe '${name}'?`)) {
       const updated = customPresets.filter(p => p.name !== name);
       setCustomPresets(updated);
       
       // Sync to Auth Service
       if (currentUser) {
         await authService.saveUserData(currentUser.uid, 'presets', updated);
       }
    }
  };

  const updateSetting = (key: keyof FilmSettings, value: number | string) => {
    onDevelopChange({ settings: { ...settings, [key]: value }, logs: developLogs });
  };

  const calculateDiff = (base: FilmSettings, target: Partial<FilmSettings>): Partial<FilmSettings> => {
    const diff: Partial<FilmSettings> = {};
    (Object.keys(target) as Array<keyof FilmSettings>).forEach((key) => {
        if (typeof target[key] === 'number' && typeof base[key] === 'number') {
             // @ts-ignore
            diff[key] = target[key] - base[key];
        } else if (key === 'vignetteColor') {
            diff[key] = target[key]; 
        }
    });
    return diff;
  };

  const { activeStockId, isModified } = useMemo(() => {
      const lastStock = developLogs.find(l => l.type === 'stock' || l.type === 'recipe');
      if (!lastStock) return { activeStockId: null, isModified: false };

      const targetSettings = { ...DEFAULT_SETTINGS };
      if (lastStock.diff) {
         (Object.keys(lastStock.diff) as Array<keyof FilmSettings>).forEach((key) => {
             if (typeof lastStock.diff![key] === 'number') {
                // @ts-ignore
                targetSettings[key] = (targetSettings[key] as number) + (lastStock.diff![key] as number);
             } else if (key === 'vignetteColor') {
                 targetSettings[key] = lastStock.diff![key] as string;
             }
         });
      }

      let modified = false;
      const keys = Object.keys(DEFAULT_SETTINGS) as Array<keyof FilmSettings>;
      for (const k of keys) {
          if (k === 'vignetteColor') {
             if (settings[k] !== targetSettings[k]) { modified = true; break; }
          } else {
             // @ts-ignore
             const diff = Math.abs((settings[k] as number) - (targetSettings[k] as number));
             if (diff > 0.01) { modified = true; break; }
          }
      }
      return { activeStockId: lastStock.id, isModified: modified };
  }, [developLogs, settings]);

  const applyPreset = (preset: FilmPreset | CustomPreset, type: 'stock' | 'recipe' = 'stock') => {
    let targetSettings = { ...DEFAULT_SETTINGS };

    if (type === 'stock') {
        switch (preset) {
            case FilmPreset.PORTRA: targetSettings = { ...DEFAULT_SETTINGS, exposure: 10, saturation: 15, warmth: 15, grain: 25, contrast: 5, halation: 20 }; break;
            case FilmPreset.GOLD: targetSettings = { ...DEFAULT_SETTINGS, exposure: 5, saturation: 25, warmth: 35, grain: 30, contrast: 10, halation: 10, vignetteColor: '#3e2723', vignette: 15 }; break;
            case FilmPreset.SUPERIA: targetSettings = { ...DEFAULT_SETTINGS, exposure: 5, saturation: 20, warmth: -5, grain: 30, contrast: 15, vignette: 10 }; break;
            case FilmPreset.VISTA: targetSettings = { ...DEFAULT_SETTINGS, exposure: 10, saturation: 40, contrast: 20, warmth: 10, grain: 15 }; break;
            case FilmPreset.ILFORD: targetSettings = { ...DEFAULT_SETTINGS, saturation: -100, contrast: 25, grain: 55, exposure: 5, vignette: 20 }; break;
            case FilmPreset.TRI_X: targetSettings = { ...DEFAULT_SETTINGS, saturation: -100, contrast: 45, grain: 70, exposure: 10, vignette: 30, halation: 10 }; break;
            case FilmPreset.CINESTILL: targetSettings = { ...DEFAULT_SETTINGS, warmth: -10, exposure: 0, contrast: 15, vignette: 40, blur: 10, halation: 80, vignetteColor: '#000000' }; break;
            case FilmPreset.KODACHROME: targetSettings = { ...DEFAULT_SETTINGS, saturation: 30, contrast: 30, warmth: 10, grain: 20, vignette: 15 }; break;
            case FilmPreset.POLAROID: targetSettings = { ...DEFAULT_SETTINGS, saturation: -10, warmth: 20, contrast: -10, grain: 15, blur: 5, vignette: 35, exposure: 5, vignetteColor: '#ffffff' }; break;
            case FilmPreset.LOMO: targetSettings = { ...DEFAULT_SETTINGS, warmth: -40, contrast: 25, saturation: 30, vignette: 60, halation: 40, grain: 40, vignetteColor: '#0d47a1' }; break;
        }
    } else {
        targetSettings = { ...(preset as CustomPreset).settings };
    }

    const cleanedLog = developLogs.filter(item => item.type !== 'stock' && item.type !== 'recipe');
    const newItem: AiLogItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: type,
      prompt: type === 'stock' ? `Stock: ${preset}` : `Recipe: ${(preset as CustomPreset).name}`,
      isActive: true,
      timestamp: Date.now(),
      diff: calculateDiff(DEFAULT_SETTINGS, targetSettings) 
    };

    onDevelopChange({ settings: targetSettings, logs: [newItem, ...cleanedLog] });
  };

  const handleMagicGenerate = async () => {
    if (!magicPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const generated = await generateSettingsFromPrompt(magicPrompt);
      const newSettings = { ...settings, ...generated };
      const diff = calculateDiff(settings, generated);

      const newItem: AiLogItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'develop',
        prompt: magicPrompt,
        isActive: true,
        timestamp: Date.now(),
        diff: diff
      };

      onDevelopChange({ settings: newSettings, logs: [newItem, ...developLogs] });
      setMagicPrompt('');
    } catch (err) {
      console.error(err);
      setErrorMessage("Could not generate settings. Try a different description.");
    } finally {
      setIsGenerating(false);
    }
  };

  const computeFinalImage = (logs: AiLogItem[]): string | null => {
      const chronologicalLogs = [...logs].reverse();
      
      let currentBase = originalUpload;
      
      for (const layer of chronologicalLogs) {
          if (!layer.isActive) continue;

          // Smart Caching Logic
          // If we have a stored variation for this layer that matches the current base, use it.
          if (layer.variations && currentBase && layer.variations[currentBase]) {
               currentBase = layer.variations[currentBase];
          }
          // Otherwise, check if the legacy 'beforeImage' matches (for backward compatibility or initial creation)
          else if (layer.beforeImage === currentBase && layer.afterImage) {
              currentBase = layer.afterImage;
          } 
          // If neither matches, this layer is technically stale relative to the currentBase.
          // The UI will show the "Reprocess" button. 
          // We do NOT advance currentBase here, effectively "skipping" this layer visually until reprocessed.
      }
      return currentBase;
  };

  const handleAiEdit = async () => {
    if (!editPrompt.trim() || !currentImage) return;
    
    const activeAiLayers = aiLogs.filter(i => i.isActive);
    if (activeAiLayers.length >= 2) {
        alert("Maximum 2 AI layers allowed. Please hide or delete an existing layer to create a new one.");
        return;
    }

    setIsEditing(true);
    setErrorMessage(null);
    try {
      const newImage = await editImageWithNanoBanana(currentImage, editPrompt);
      
      const newItem: AiLogItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'ai',
        prompt: editPrompt,
        isActive: true,
        timestamp: Date.now(),
        beforeImage: currentImage,
        afterImage: newImage,
        variations: {
            [currentImage]: newImage 
        }
      };

      const newLogs = [newItem, ...aiLogs];
      onAiChange({ image: newImage, logs: newLogs });
      setEditPrompt('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "AI Generation failed. Please try again.");
    } finally {
      setIsEditing(false);
    }
  }

  const handleAnalyze = async () => {
     if(!currentImage) return;
     setIsAnalyzing(true);
     const suggestions = await analyzeImageForSuggestions(currentImage);
     if (suggestions.features.length) setSuggestedFeatures(suggestions.features);
     if (suggestions.atmosphere.length) setSuggestedAtmosphere(suggestions.atmosphere);
     setIsAnalyzing(false);
  }

  const appendToPrompt = (text: string) => {
    setEditPrompt(prev => prev ? `${prev}, ${text}` : text);
  }

  const toggleLogItem = (item: AiLogItem) => {
     if ((item.type === 'stock' || item.type === 'recipe')) {
          if (item.isActive) {
             const newLogs = developLogs.filter(i => i.id !== item.id);
             onDevelopChange({ settings: DEFAULT_SETTINGS, logs: newLogs });
          }
     } else if (item.type === 'develop' && item.diff) {
         const newActiveState = !item.isActive;
         const direction = newActiveState ? 1 : -1;
         const newSettings = { ...settings };
         
         (Object.keys(item.diff) as Array<keyof FilmSettings>).forEach((key) => {
             if (typeof item.diff![key] === 'number') {
                // @ts-ignore
                newSettings[key] = (newSettings[key] as number) + (item.diff![key] as number * direction);
             }
         });

         const newLogs = developLogs.map(i => i.id === item.id ? { ...i, isActive: newActiveState } : i);
         onDevelopChange({ settings: newSettings, logs: newLogs });

     } else if (item.type === 'ai') {
         // Strict Limit Check on Activation
         if (!item.isActive) {
             const activeCount = aiLogs.filter(i => i.isActive).length;
             if (activeCount >= 2) {
                 setErrorMessage("Cannot activate layer. Maximum 2 AI layers allowed.");
                 return;
             }
         }
         
         // AUTO-SWITCH VARIATION LOGIC
         // If we are activating this layer, let's check if we need to "Switch" subsequent layers 
         // to match the new chain output.
         
         const newLogs = aiLogs.map(i => i.id === item.id ? { ...i, isActive: !item.isActive } : i);
         const finalImage = computeFinalImage(newLogs);
         onAiChange({ image: finalImage, logs: newLogs });
     }
  };

  const deleteLogItem = (item: AiLogItem) => {
      if (item.type === 'develop' || item.type === 'stock' || item.type === 'recipe') {
          if (item.isActive) {
              const direction = -1;
              const newSettings = { ...settings };
              if (item.diff) {
                 (Object.keys(item.diff) as Array<keyof FilmSettings>).forEach((key) => {
                     if (typeof item.diff![key] === 'number') {
                        // @ts-ignore
                        newSettings[key] = (newSettings[key] as number) + (item.diff![key] as number * direction);
                     }
                 });
              } else if (item.type === 'stock' || item.type === 'recipe') {
                  Object.assign(newSettings, DEFAULT_SETTINGS);
              }
              const newLogs = developLogs.filter(i => i.id !== item.id);
              onDevelopChange({ settings: newSettings, logs: newLogs });
          } else {
              const newLogs = developLogs.filter(i => i.id !== item.id);
              onDevelopChange({ settings, logs: newLogs });
          }

      } else if (item.type === 'ai') {
          const newLogs = aiLogs.filter(i => i.id !== item.id);
          const finalImage = computeFinalImage(newLogs);
          onAiChange({ image: finalImage, logs: newLogs });
          clearFutureImageHistory();
      }
  };

  const startEditing = (item: AiLogItem) => {
      setEditingId(item.id);
      setTempEditText(item.prompt);
  };

  const cancelEditing = () => {
      setEditingId(null);
      setTempEditText('');
  };

  const handleRegenerate = async (item: AiLogItem, useCurrentBase: boolean = false) => {
      setLoadingItems(prev => new Set(prev).add(item.id));
      setEditingId(null);
      setErrorMessage(null);

      try {
          if (item.type === 'ai') {
              const chronologicalLogs = [...aiLogs].reverse();
              const myIndex = chronologicalLogs.findIndex(l => l.id === item.id);
              
              // Calculate what the base image IS right now before this layer
              let calculatedBase = originalUpload;
              for (let i = 0; i < myIndex; i++) {
                  const prev = chronologicalLogs[i];
                  if (prev.isActive) {
                       if (prev.variations && calculatedBase && prev.variations[calculatedBase]) {
                           calculatedBase = prev.variations[calculatedBase];
                       } else if (prev.beforeImage === calculatedBase && prev.afterImage) {
                           calculatedBase = prev.afterImage;
                       }
                  }
              }
              
              if (!calculatedBase) throw new Error("Could not determine base image.");

              const newImage = await editImageWithNanoBanana(calculatedBase, tempEditText || item.prompt);
              
              const newItem: AiLogItem = {
                  ...item,
                  prompt: tempEditText || item.prompt,
                  isActive: true,
                  timestamp: Date.now(),
                  beforeImage: calculatedBase, 
                  afterImage: newImage,
                  variations: {
                      ...(item.variations || {}),
                      [calculatedBase]: newImage 
                  }
              };

              const newLogs = aiLogs.map(i => i.id === item.id ? newItem : i);
              const finalImage = computeFinalImage(newLogs);
              onAiChange({ image: finalImage, logs: newLogs });

          } else if (item.type === 'develop') {
             const direction = -1;
             const tempSettings = { ...settings };
             if (item.diff) {
                 (Object.keys(item.diff) as Array<keyof FilmSettings>).forEach((key) => {
                     if (typeof item.diff![key] === 'number') {
                        // @ts-ignore
                        tempSettings[key] = (tempSettings[key] as number) + (item.diff![key] as number * direction);
                     }
                 });
             }
             
             const generated = await generateSettingsFromPrompt(tempEditText || item.prompt);
             const newSettings = { ...tempSettings, ...generated };
             const newDiff = calculateDiff(tempSettings, generated);

             const newItem: AiLogItem = {
                 ...item,
                 prompt: tempEditText || item.prompt,
                 diff: newDiff
             };
             
             const newLogs = developLogs.map(i => i.id === item.id ? newItem : i);
             onDevelopChange({ settings: newSettings, logs: newLogs });
          }

      } catch (e: any) {
          console.error("Failed to regenerate", e);
          setErrorMessage("Regeneration failed. " + e.message);
      } finally {
          setLoadingItems(prev => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
          });
      }
  };

  const isLayerStale = (item: AiLogItem) => {
     if (item.type !== 'ai' || !item.isActive) return false;
     
     const chronologicalLogs = [...aiLogs].reverse();
     const myIndex = chronologicalLogs.findIndex(l => l.id === item.id);
     
     let expectedBase = originalUpload;
     for (let i = 0; i < myIndex; i++) {
         const prev = chronologicalLogs[i];
         if (prev.isActive) {
              if (prev.variations && expectedBase && prev.variations[expectedBase]) {
                  expectedBase = prev.variations[expectedBase];
              } else if (prev.beforeImage === expectedBase && prev.afterImage) {
                  expectedBase = prev.afterImage;
              }
         }
     }
     return !(item.variations && expectedBase && item.variations[expectedBase]);
  };

  const activeLogCount = (type: string) => {
      if (type === 'develop') return developLogs.length; 
      return aiLogs.filter(i => i.isActive).length;
  }

  const handleUndo = activeTab === 'develop' ? undoSettings : undoImage;
  const handleRedo = activeTab === 'develop' ? redoSettings : redoImage;
  const canUndo = activeTab === 'develop' ? canUndoSettings : canUndoImage;
  const canRedo = activeTab === 'develop' ? canRedoSettings : canRedoImage;

  const activeLogsDisplay = activeTab === 'develop' ? developLogs : aiLogs;
  const aiLayerLimitReached = activeLogCount('ai') >= 2;

  return (
    <div className="flex flex-col w-full md:w-80 h-auto md:h-full bg-film-panel border-t md:border-t-0 md:border-l border-film-border shrink-0 z-30 shadow-2xl relative md:overflow-hidden">
      
      <ProcessingOverlay isVisible={isGenerating || isEditing || isAnalyzing || loadingItems.size > 0} text={isAnalyzing ? "ANALYZING SPECTRUM" : "PROCESSING NEURAL EDIT"} />

      {/* Error Toast */}
      {errorMessage && (
          <div className="absolute top-4 left-4 right-4 bg-red-900/90 border border-red-500 text-white p-3 rounded shadow-2xl z-50 text-xs animate-in slide-in-from-top-5">
              <div className="flex justify-between items-start gap-2">
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="text-red-200 hover:text-white">✕</button>
              </div>
          </div>
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-film-border sticky top-0 z-20">
         <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${activeTab === 'ai' ? 'bg-film-accent animate-pulse' : 'bg-zinc-600'}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">
              {activeTab === 'ai' ? 'AI Lab' : 'Develop'}
            </span>
         </div>
         <div className="flex gap-1">
            <button onClick={handleUndo} disabled={!canUndo} className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-white transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
            <button onClick={handleRedo} disabled={!canRedo} className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-white transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
         </div>
      </div>

      <div className="flex border-b border-film-border sticky top-[45px] z-20 bg-film-panel">
        <button onClick={() => setActiveTab('develop')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'develop' ? 'text-film-accent bg-zinc-800/50 border-b-2 border-film-accent' : 'text-film-muted hover:text-white'}`}>Develop</button>
        <button onClick={() => setActiveTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'ai' ? 'text-film-accent bg-zinc-800/50 border-b-2 border-film-accent' : 'text-film-muted hover:text-white'}`}>AI Lab</button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 p-5 space-y-6 md:overflow-y-auto scrollbar-thin relative">
        
        {activeTab === 'develop' && (
           <Histogram imageSrc={currentImage} settings={settings} comparePos={comparePos} />
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             {/* Destructive Warning Banner */}
             <div className="bg-amber-900/20 border border-amber-700/50 p-3 rounded flex items-start gap-2">
                 <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 <div>
                    <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Destructive Edit</h4>
                    <p className="text-[10px] text-amber-100/80 leading-tight mt-1">
                       AI edits replace the base photo. <span className="text-amber-400 font-bold">Max 2 Layers.</span>
                    </p>
                 </div>
             </div>

             {/* Prompt Input */}
             <div>
                <label className="text-[10px] font-bold text-film-muted uppercase tracking-widest mb-2 block">Generative Prompt</label>
                <textarea 
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  disabled={aiLayerLimitReached}
                  placeholder={aiLayerLimitReached ? "Limit reached (Max 2 Layers)" : "e.g. 'Make it look like a rainy day in Tokyo'"}
                  className="w-full bg-film-bg border border-film-border rounded p-3 text-xs text-white focus:border-film-accent focus:outline-none min-h-[80px] resize-none mb-2 placeholder:text-zinc-500 disabled:opacity-50"
                />
                <button 
                  onClick={handleAiEdit}
                  disabled={isEditing || !editPrompt.trim() || aiLayerLimitReached}
                  className="w-full bg-film-accent hover:bg-film-accentHover text-black font-bold py-2.5 rounded text-xs uppercase tracking-wide transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-film-accent/10"
                >
                  {isEditing ? 'Processing...' : aiLayerLimitReached ? 'Layer Limit Reached' : 'Generate Edit'}
                </button>
             </div>

             {/* Suggestions */}
             <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                   <label className="text-[10px] font-bold text-film-muted uppercase tracking-widest">Smart Suggestions</label>
                   <button onClick={handleAnalyze} disabled={isAnalyzing} className="text-[10px] text-film-accent hover:underline disabled:opacity-50">
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
                   </button>
                </div>
                
                <div className="mb-3">
                    <span className="text-[9px] text-zinc-400 uppercase font-bold block mb-1.5">Atmosphere</span>
                    <div className="flex flex-wrap gap-1.5">
                        {suggestedAtmosphere.map(s => (
                            <button key={s} onClick={() => appendToPrompt(s)} disabled={aiLayerLimitReached} className="text-[9px] px-2 py-1 bg-zinc-800 text-zinc-200 hover:bg-film-accent hover:text-black rounded-full border border-zinc-700 transition-colors disabled:opacity-50">{s}</button>
                        ))}
                    </div>
                </div>
                 <div>
                    <span className="text-[9px] text-zinc-400 uppercase font-bold block mb-1.5">Transformations</span>
                    <div className="flex flex-wrap gap-1.5">
                        {suggestedFeatures.map(s => (
                            <button key={s} onClick={() => appendToPrompt(s)} disabled={aiLayerLimitReached} className="text-[9px] px-2 py-1 bg-zinc-800 text-zinc-200 hover:bg-film-accent hover:text-black rounded-full border border-zinc-700 transition-colors disabled:opacity-50">{s}</button>
                        ))}
                    </div>
                </div>
             </div>
          </div>
        )}

        {/* LOG DISPLAY (Shared) */}
        {activeLogsDisplay.length > 0 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${activeTab === 'ai' ? 'text-film-accent' : 'text-pink-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ai' ? 'bg-film-accent' : 'bg-pink-500'}`}></div> 
                    Activated Changes {activeTab === 'ai' ? `(${activeLogCount('ai')}/2)` : ''}
                </label>
                {activeLogsDisplay.map(item => {
                    const isLoading = loadingItems.has(item.id);
                    const isEditingItem = editingId === item.id;
                    const stale = isLayerStale(item);

                    return (
                    <div key={item.id} className={`group relative p-2 rounded border transition-all ${item.isActive ? (activeTab === 'ai' ? 'bg-zinc-900 border-film-accent/30' : 'bg-zinc-900 border-pink-500/30') : 'bg-zinc-950 border-zinc-800 opacity-60'}`}>
                        {stale && (
                            <div className="absolute inset-0 border-l-2 border-orange-500 bg-orange-500/5 z-0 pointer-events-none rounded-l-sm"></div>
                        )}
                        
                        {isLoading && (
                           <div className="absolute inset-0 bg-black/90 z-20 flex items-center justify-center backdrop-blur-sm">
                              <div className="flex items-center gap-2">
                                 <div className="w-4 h-4 rounded-full border-2 border-film-accent border-t-transparent animate-spin"></div>
                                 <span className="text-[9px] font-mono text-film-accent animate-pulse">REPROCESSING...</span>
                              </div>
                           </div>
                        )}
                        
                        {isEditingItem ? (
                            <div className="flex flex-col gap-2 z-10 relative">
                                <input autoFocus type="text" className={`w-full bg-black border rounded px-2 py-1 text-[10px] text-white focus:outline-none ${activeTab === 'ai' ? 'border-film-accent' : 'border-pink-500'}`} value={tempEditText} onChange={(e) => setTempEditText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRegenerate(item)} />
                                <div className="flex justify-end gap-2">
                                <button onClick={cancelEditing} className="text-[10px] text-zinc-400 hover:text-white px-2">Cancel</button>
                                <button onClick={() => handleRegenerate(item)} className={`text-[10px] text-black px-2 py-0.5 rounded font-bold ${activeTab === 'ai' ? 'bg-film-accent' : 'bg-pink-500'}`}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="z-10 relative">
                            <div className="flex items-center justify-between">
                                <span className={`text-[10px] truncate ${item.isActive ? 'text-white' : 'text-zinc-500 decoration-line-through'}`}>{item.prompt}</span>
                                <div className="flex gap-1 opacity-80 group-hover:opacity-100">
                                    <button onClick={() => startEditing(item)} className={`p-1 hover:text-${activeTab === 'ai' ? 'film-accent' : 'pink-500'} text-zinc-400`} title="Edit Prompt"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                    <button onClick={() => toggleLogItem(item)} className={`p-1 hover:text-${activeTab === 'ai' ? 'film-accent' : 'pink-500'} text-zinc-400`} title={item.isActive ? "Hide" : "Show"}>{item.isActive ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.059 10.059 0 013.999-5.188m9.639 4.464l.288.529a3 3 0 11-4.769-2.723" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>}</button>
                                    <button onClick={() => deleteLogItem(item)} className="p-1 hover:text-red-500 text-zinc-400" title="Delete"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                            {stale && (
                                <div className="mt-2 bg-black/40 p-2 rounded border border-orange-500/30 flex items-center justify-between animate-in fade-in slide-in-from-left-2">
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-3 h-3 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        <span className="text-[9px] text-orange-200">Base changed. Update required.</span>
                                    </div>
                                    <button 
                                        onClick={() => handleRegenerate(item, true)}
                                        className="text-[9px] font-bold bg-orange-500 text-black hover:bg-orange-400 px-2 py-1 rounded transition-colors shadow-lg shadow-orange-900/20"
                                    >
                                        Reprocess
                                    </button>
                                </div>
                            )}
                            </div>
                        )}
                    </div>
                    )
                })}
            </div>
        )}

        {activeTab === 'develop' && (
            <>
              {/* Magic Match */}
               <div className="bg-film-bg/30 p-3 rounded border border-film-border/50">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3 h-3 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-film-text">Magic Match</span>
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={magicPrompt}
                            onChange={(e) => setMagicPrompt(e.target.value)}
                            placeholder="Describe a look (e.g. 'Blade Runner')"
                            className="flex-1 bg-film-bg border border-film-border rounded px-2 py-1.5 text-xs text-white focus:border-film-accent focus:outline-none placeholder:text-zinc-600"
                            onKeyDown={(e) => e.key === 'Enter' && handleMagicGenerate()}
                        />
                        <button 
                            onClick={handleMagicGenerate}
                            disabled={isGenerating}
                            className="bg-zinc-800 hover:bg-film-accent hover:text-black text-white px-3 rounded transition-colors"
                        >
                            {isGenerating ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '→'}
                        </button>
                    </div>
                </div>

             {/* Standard Presets */}
              <div>
                 <h3 className="text-[10px] font-bold text-film-muted uppercase tracking-widest mb-3">Film Stocks (Base)</h3>
                 <div className="grid grid-cols-2 gap-2 mb-4">
                    {Object.entries(FilmPreset).map(([key, label]) => {
                        const isActive = developLogs.some(l => (l.type === 'stock' && l.prompt === `Stock: ${label}`) && l.isActive);
                        const showEdited = isActive && isModified;
                        return (
                            <button key={key} onClick={() => applyPreset(label as FilmPreset, 'stock')} className={`text-[11px] text-left px-3 py-2 rounded border transition-all active:scale-95 truncate flex items-center justify-between ${isActive ? 'bg-zinc-800 border-film-accent/50 text-white' : 'bg-film-bg border-transparent text-film-text hover:bg-zinc-800 hover:border-film-border'}`}>
                                <span className="truncate">{label}</span>
                                {showEdited && <span className="text-[9px] text-film-accent italic opacity-80 ml-1 whitespace-nowrap">(Edited)</span>}
                            </button>
                        );
                    })}
                 </div>
              </div>

              {/* Saved Recipes */}
              {customPresets.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-film-muted uppercase tracking-widest mb-3">Your Recipes</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {customPresets.map((preset) => {
                           const isActive = developLogs.some(l => (l.type === 'recipe' && l.prompt === `Recipe: ${preset.name}`) && l.isActive);
                           const showEdited = isActive && isModified;
                           return (
                           <div key={preset.name} className="relative group">
                                <button onClick={() => applyPreset(preset, 'recipe')} className={`w-full text-[11px] text-left px-3 py-2 rounded border transition-all active:scale-95 truncate flex items-center justify-between ${isActive ? 'bg-zinc-800 border-film-accent/50 text-film-accent' : 'bg-film-panel border-film-border/50 hover:bg-zinc-800 hover:border-film-accent/30 text-film-accent'}`}>
                                    <span className="truncate">{preset.name}</span>
                                    {showEdited && <span className="text-[9px] italic opacity-80 ml-1">*</span>}
                                </button>
                                <button onClick={(e) => deletePreset(preset.name, e)} className="absolute right-1 top-1.5 p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 text-zinc-500 transition-opacity bg-zinc-900 rounded"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                           </div>
                        )})}
                    </div>
                </div>
              )}

              {!isSavingRecipe ? (
                  <button onClick={initiateSavePreset} className="w-full mb-4 py-2 bg-zinc-900 border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-film-accent rounded text-[10px] uppercase font-bold tracking-widest transition-all">
                    + Save Current Look as a New Recipe
                  </button>
              ) : (
                  <div className="flex gap-2 mb-4 animate-in fade-in slide-in-from-top-1">
                      <input autoFocus type="text" className="flex-1 bg-black border border-film-accent text-white text-xs rounded px-2" value={newRecipeName} onChange={(e) => setNewRecipeName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmSavePreset()} />
                      <button onClick={confirmSavePreset} className="px-3 bg-film-accent text-black text-xs font-bold rounded">Save</button>
                      <button onClick={() => setIsSavingRecipe(false)} className="px-3 bg-zinc-800 text-white text-xs rounded">X</button>
                  </div>
              )}

              <div className="space-y-4">
                 <SliderControl label="Exposure" value={settings.exposure} min={-100} max={100} onChange={(v) => updateSetting('exposure', v)} visualType="exposure" />
                 <SliderControl label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => updateSetting('contrast', v)} visualType="contrast" />
                 <SliderControl label="Saturation" value={settings.saturation} min={-100} max={100} onChange={(v) => updateSetting('saturation', v)} visualType="saturation" />
                 <SliderControl label="Warmth" value={settings.warmth} min={-100} max={100} onChange={(v) => updateSetting('warmth', v)} visualType="warmth" />
              </div>

              <div className="space-y-4 mt-4">
                 <SliderControl label="Film Grain" value={settings.grain} min={0} max={100} onChange={(v) => updateSetting('grain', v)} visualType="grain" />
                 <SliderControl label="Halation" value={settings.halation} min={0} max={100} onChange={(v) => updateSetting('halation', v)} visualType="halation" />
                 <SliderControl label="Bloom" value={settings.blur} min={0} max={100} onChange={(v) => updateSetting('blur', v)} />
                 <div className="space-y-2">
                   <SliderControl label="Vignette Strength" value={settings.vignette} min={0} max={100} onChange={(v) => updateSetting('vignette', v)} visualType="vignette" />
                   <div className="flex justify-between items-center">
                      <label className="text-xs text-zinc-300">Vignette Color</label>
                      <div className="flex gap-1">
                        {VIGNETTE_COLORS.map((c) => (
                          <button key={c.color} onClick={() => updateSetting('vignetteColor', c.color)} className={`w-4 h-4 rounded-full border border-zinc-600 ${settings.vignetteColor === c.color ? 'ring-1 ring-film-accent' : ''}`} style={{ backgroundColor: c.color }} />
                        ))}
                      </div>
                   </div>
                 </div>
              </div>
            </>
        )}
      </div>

      <div className="p-4 border-t border-film-border bg-film-panel">
        <button onClick={() => onDevelopChange({ settings: DEFAULT_SETTINGS, logs: [] })} className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-film-muted hover:text-white border border-film-border hover:border-zinc-600 rounded transition-colors">Reset Settings</button>
      </div>
    </div>
  );
};

const SliderControl: React.FC<{ label: string; value: number; min: number; max: number; onChange: (val: number) => void; visualType?: string; }> = ({ label, value, min, max, onChange, visualType }) => {
    let bgGradient = '';
    switch (visualType) {
        case 'exposure': bgGradient = 'bg-gradient-to-r from-black via-zinc-600 to-white'; break;
        case 'contrast': bgGradient = 'bg-gradient-to-r from-zinc-400 via-zinc-600 to-black'; break;
        case 'saturation': bgGradient = 'bg-gradient-to-r from-zinc-500 via-red-500 to-blue-500'; break;
        case 'warmth': bgGradient = 'bg-gradient-to-r from-blue-500 via-zinc-500 to-orange-500'; break;
        case 'halation': bgGradient = 'bg-gradient-to-r from-black to-orange-500'; break;
        case 'vignette': bgGradient = 'bg-gradient-to-r from-white to-black'; break;
        case 'grain': bgGradient = 'bg-gradient-to-r from-zinc-800 to-zinc-400'; break;
    }

    return (
        <div className="group">
            <div className="flex justify-between items-end mb-2">
            <label className="text-xs text-zinc-200 group-hover:text-white transition-colors">{label}</label>
            <span className="font-mono text-[10px] text-film-accent bg-film-accent/10 px-1.5 rounded">{value}</span>
            </div>
            <div className="relative h-5 flex items-center">
            {bgGradient && <div className={`absolute inset-x-0 h-0.5 top-[9px] rounded-full ${bgGradient} opacity-50 pointer-events-none`} />}
            <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full relative z-10 opacity-90 hover:opacity-100 transition-opacity" />
            </div>
        </div>
    );
};
