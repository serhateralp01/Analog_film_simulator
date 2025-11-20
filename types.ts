
export interface FilmSettings {
  exposure: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  warmth: number; // -100 to 100 (Blue to Orange)
  grain: number; // 0 to 100
  vignette: number; // 0 to 100
  vignetteColor: string; // Hex Code
  blur: number; // 0 to 100 (Softness)
  halation: number; // 0 to 100 (Highlight Glow)
}

export const DEFAULT_SETTINGS: FilmSettings = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  grain: 0,
  vignette: 0,
  vignetteColor: '#000000',
  blur: 0,
  halation: 0,
};

export enum FilmPreset {
  NONE = 'Standard',
  PORTRA = 'Portra 400',
  GOLD = 'Kodak Gold 200',
  SUPERIA = 'Fuji Superia 400',
  VISTA = 'Agfa Vista 200',
  ILFORD = 'Ilford HP5',
  TRI_X = 'Tri-X 400',
  CINESTILL = 'CineStill 800T',
  KODACHROME = 'Kodachrome',
  POLAROID = 'Polaroid 600',
  LOMO = 'Lomo Purple'
}

export interface AiLogItem {
  id: string;
  type: 'develop' | 'ai' | 'stock' | 'recipe';
  prompt: string;
  isActive: boolean;
  timestamp: number;
  // For Develop/Stock (Diff based)
  diff?: Partial<FilmSettings>;
  // For AI (State based)
  beforeImage?: string;
  afterImage?: string;
  variations?: Record<string, string>;
}
