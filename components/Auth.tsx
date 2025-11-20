
import React, { useState } from 'react';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
       setLoading(false);
       onLogin();
    }, 1000);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent z-20">
      <div className="absolute inset-0 scanlines z-10 opacity-20 pointer-events-none"></div>

      <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/60 backdrop-blur-xl border border-zinc-800/50 p-8 shadow-2xl animate-in zoom-in-95 duration-500 relative">
           
           {/* Decorative corner markers */}
           <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-film-accent"></div>
           <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-film-accent"></div>
           <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-film-accent"></div>
           <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-film-accent"></div>

           <div className="text-center mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Identify</h2>
              <p className="text-zinc-300 text-xs font-mono">Access saved recipes & history.</p>
           </div>

           {/* Google Sign In */}
           <button 
              onClick={onLogin}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 border border-zinc-700 hover:border-film-accent/50 transition-all flex items-center justify-center gap-3 group"
           >
              <svg className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
                 <path d="M12.24 24.0008C15.4765 24.0008 18.2058 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.24 24.0008Z" fill="#34A853"/>
                 <path d="M5.50253 14.3003C5.00236 12.8099 5.00236 11.1961 5.50253 9.70575V6.61481H1.5166C-0.185974 10.0056 -0.185974 14.0004 1.5166 17.3912L5.50253 14.3003Z" fill="#FBBC05"/>
                 <path d="M12.24 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.24 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50253 9.70575C6.45064 6.86173 9.10947 4.74966 12.24 4.74966Z" fill="#EA4335"/>
              </svg>
              <span className="font-mono text-xs uppercase tracking-wider">Sign in with Google</span>
           </button>

           <div className="flex items-center gap-4 mb-6 mt-6">
              <div className="h-px flex-1 bg-zinc-800"></div>
              <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Or</span>
              <div className="h-px flex-1 bg-zinc-800"></div>
           </div>

           <form onSubmit={handleSubmit} className="space-y-4">
              <div className="group">
                 <input 
                   type="email" 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full bg-black/50 border border-zinc-800 px-4 py-3 text-white text-sm focus:border-film-accent focus:outline-none transition-colors font-mono placeholder:text-zinc-400"
                   placeholder="EMAIL_ADDRESS"
                 />
              </div>
              <div>
                 <input 
                   type="password" 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full bg-black/50 border border-zinc-800 px-4 py-3 text-white text-sm focus:border-film-accent focus:outline-none transition-colors font-mono placeholder:text-zinc-400"
                   placeholder="ACCESS_CODE"
                 />
              </div>

              <button 
                 type="submit"
                 disabled={loading}
                 className="w-full bg-film-accent text-black font-bold py-3.5 mt-4 transition-all flex justify-center uppercase tracking-widest text-xs hover:bg-white"
              >
                 {loading ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                 ) : "Authenticate"}
              </button>
           </form>
           
           <div className="mt-6 pt-6 border-t border-zinc-800/50 text-center">
               <button onClick={onLogin} className="text-[10px] text-zinc-400 hover:text-film-accent transition-colors font-mono uppercase tracking-wider">
                  Bypass Authentication (Guest Mode)
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};
