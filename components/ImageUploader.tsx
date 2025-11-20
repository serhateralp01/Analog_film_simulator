
import React, { ChangeEvent } from 'react';

interface ImageUploaderProps {
  onImageSelected: (imageUrl: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageSelected(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative group w-full h-full min-h-[200px] flex items-center justify-center">
      <div className="absolute inset-0 bg-zinc-900/40 border border-zinc-700/50 rounded-2xl backdrop-blur-sm group-hover:bg-zinc-800/50 group-hover:border-film-accent/50 transition-all duration-300"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center p-8">
        <div className="w-20 h-20 mb-6 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-film-accent group-hover:text-black text-zinc-400 transition-all duration-300 shadow-xl">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        
        <h3 className="text-2xl font-light text-white mb-2 tracking-tight">Upload Photo</h3>
        <p className="text-zinc-300 text-sm mb-6 font-light">
          JPG, PNG, WebP accepted
        </p>
        
        <button className="px-6 py-2.5 bg-white text-black rounded-full text-sm font-bold uppercase tracking-wider hover:bg-film-accent transition-colors shadow-lg shadow-white/5">
          Select File
        </button>
      </div>

      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
      />
    </div>
  );
};
