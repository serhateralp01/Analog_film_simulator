
import React, { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { FilmControls } from './components/FilmControls';
import { PreviewCanvas } from './components/PreviewCanvas';
import { FilmSettings, DEFAULT_SETTINGS, AiLogItem } from './types';
import { useHistory } from './hooks/useHistory';
import { Onboarding } from './components/Onboarding';
import { Auth } from './components/Auth';
import { ShaderBackground } from './components/ShaderBackground';
import { authService, UserProfile } from './services/authService';

type ViewState = 'onboarding' | 'auth' | 'app';

// Composite State Interfaces for History
export interface DevelopState {
  settings: FilmSettings;
  logs: AiLogItem[];
}

export interface AiState {
  image: string | null;
  logs: AiLogItem[];
}

const App: React.FC = () => {
  // Auth & Routing State
  const [view, setView] = useState<ViewState>('onboarding');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  // Initialize session
  useEffect(() => {
     const user = authService.getCurrentUser();
     if (user) {
        setCurrentUser(user);
        setView('app');
     }
  }, []);

  const handleGetStarted = () => setView('auth');
  
  const handleLogin = (user: UserProfile) => {
     setCurrentUser(user);
     setView('app');
  };

  // --- App Logic ---

  // Keep track of the absolutely original file for comparison
  const [originalUpload, setOriginalUpload] = useState<string | null>(null);
  
  // Shared State for Comparison Slider
  const [comparePos, setComparePos] = useState(50);

  // Undo/Redo History for the Base Image (AI Lab changes)
  const imageHistory = useHistory<AiState>({ image: null, logs: [] });

  // Undo/Redo History for the Film Settings (Develop changes)
  const settingsHistory = useHistory<DevelopState>({ settings: DEFAULT_SETTINGS, logs: [] });

  const handleReset = () => {
    imageHistory.reset({ image: null, logs: [] });
    settingsHistory.reset({ settings: DEFAULT_SETTINGS, logs: [] });
    setOriginalUpload(null);
    setComparePos(50);
  };

  // Updated Handlers to accept composite state
  const handleDevelopChange = (newState: DevelopState) => {
    settingsHistory.set(newState);
  };

  const handleAiChange = (newState: AiState) => {
    imageHistory.set(newState);
  };

  const handleInitialUpload = (imageUrl: string) => {
    setOriginalUpload(imageUrl);
    
    // Reset history stacks with initial valid state
    const initialAiState = { image: imageUrl, logs: [] };
    const initialDevelopState = { settings: DEFAULT_SETTINGS, logs: [] };
    
    imageHistory.reset(initialAiState);
    imageHistory.clearHistory();
    
    settingsHistory.reset(initialDevelopState);
    settingsHistory.clearHistory();
    setComparePos(50);
  };

  // Calculate Shader Intensity based on View
  const getShaderIntensity = () => {
      if (view === 'onboarding') return 1.5;
      if (view === 'auth') return 0.5;
      return 0.3; // App mode
  }

  // --- RENDER ---

  return (
    <div className="relative flex min-h-screen w-full bg-film-bg text-film-text font-sans selection:bg-film-accent selection:text-black">
      
      {/* Global Persistent Shader Background */}
      <ShaderBackground intensity={getShaderIntensity()} />

      {view === 'onboarding' && <Onboarding onGetStarted={handleGetStarted} />}
      
      {view === 'auth' && <Auth onLogin={handleLogin} />}

      {view === 'app' && (
        <>
          {!imageHistory.state.image ? (
            // Upload State
            <div className="relative w-full min-h-screen overflow-hidden">
                <div className="absolute inset-0 scanlines opacity-10 pointer-events-none"></div>
                
                {/* Profile/SignOut */}
                <div className="absolute top-6 right-6 z-30 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <div className="text-right">
                        <div className="text-xs font-bold text-white uppercase">{currentUser?.displayName}</div>
                        <div className="text-[9px] font-mono text-zinc-400">{currentUser?.email}</div>
                    </div>
                    <button onClick={() => { authService.logout(); setView('onboarding'); }} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white hover:border-film-accent transition-colors rounded">
                        Logout
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden z-10 w-full h-full min-h-screen">
                    <div className="z-10 text-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-2 mix-blend-difference">Analog<span className="text-film-accent">.ai</span></h1>
                        <p className="text-zinc-300 max-w-md mx-auto text-lg font-mono tracking-wide">
                        System Ready. Awaiting Input.
                        </p>
                    </div>

                    <div className="w-full max-w-xl h-80 z-10 animate-in fade-in zoom-in duration-500 delay-150">
                        <ImageUploader onImageSelected={handleInitialUpload} />
                    </div>
                </div>
            </div>
          ) : (
            // Editor State
            // Mobile: Flex Column, Natural Scroll (No h-screen constraint). 
            // Desktop: Fixed Height (h-screen), No Window Scroll (overflow-hidden).
            <div className="flex flex-col md:flex-row w-full min-h-screen md:h-screen md:overflow-hidden z-20 bg-black/50 backdrop-blur-sm">
                
                {/* Main Preview Area */}
                {/* Mobile: Fixed height block, stays at top. Desktop: Flex Grow */}
                <div className="w-full h-[50vh] md:h-full md:flex-1 shrink-0 relative border-b md:border-b-0 md:border-r border-zinc-800">
                    <PreviewCanvas 
                      imageUrl={imageHistory.state.image} 
                      originalUpload={originalUpload}
                      settings={settingsHistory.state.settings} 
                      onReupload={handleReset}
                      comparePos={comparePos}
                      setComparePos={setComparePos}
                    />
                </div>

                {/* Sidebar Controls */}
                {/* Mobile: Auto height (scrolls with page body). Desktop: Fixed width, internal scroll */}
                <div className="w-full md:w-80 md:h-full shrink-0">
                    <FilmControls 
                      // Develop State
                      settings={settingsHistory.state.settings} 
                      developLogs={settingsHistory.state.logs}
                      onDevelopChange={handleDevelopChange}
                      
                      undoSettings={settingsHistory.undo}
                      redoSettings={settingsHistory.redo}
                      canUndoSettings={settingsHistory.canUndo}
                      canRedoSettings={settingsHistory.canRedo}

                      // AI State
                      currentImage={imageHistory.state.image}
                      aiLogs={imageHistory.state.logs}
                      onAiChange={handleAiChange}
                      
                      originalUpload={originalUpload}
                      undoImage={imageHistory.undo}
                      redoImage={imageHistory.redo}
                      canUndoImage={imageHistory.canUndo}
                      canRedoImage={imageHistory.canRedo}
                      clearFutureImageHistory={imageHistory.clearFuture}
                      
                      comparePos={comparePos}
                      currentUser={currentUser}
                    />
                </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;
