import { create } from 'zustand';

export type AvatarEntry = {
  id: string;
  name: string;
  description: string;
  model_file_url: string;
  format: string;
  thumbnail_url: string;
  collection?: string; // Track which collection an avatar belongs to
  metadata?: {
    number?: string;
    series?: string;
  };
};

// Type for the project structure from projects.json
type ProjectEntry = {
  id: string;
  name: string;
  creator_id: string;
  description: string;
  is_public: boolean;
  license: string;
  source_type: string;
  created_at: string;
  updated_at: string;
  avatar_data_file: string; // Relative path to the avatar list for this project
  source_network?: string;
  source_contract?: string;
  opensea_url?: string;
};

type AvatarListState = {
  avatars: AvatarEntry[];           // All avatars for library browsing
  randomPool: AvatarEntry[];        // Only 100Avatars for randomization
  isLoading: boolean;
  error: string | null;
  fetchAvatars: () => Promise<void>;
  getRandomAvatar: () => AvatarEntry | null;
};

// Updated URL to fetch projects.json
const PROJECTS_LIST_URL = 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/projects.json';
const AVATAR_DATA_BASE_URL = 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/';

// Collections used for random avatar cycling (100Avatars only)
const RANDOM_COLLECTIONS = [
  '100avatars-r1',
  '100avatars-r2', 
  '100avatars-r3',
];

// All collections available in the avatar library browser
const LIBRARY_COLLECTIONS = [
  '100avatars-r1',
  '100avatars-r2', 
  '100avatars-r3',
  'halloween-rising',
  'xmas-chibis',
  'NeonGlitch86-collection',
  'toxsam',
  'vipe-heroes-genesis',
  'grifters-squaddies',
];

export const useAvatarListStore = create<AvatarListState>((set, get) => ({
  avatars: [],
  randomPool: [],
  isLoading: false,
  error: null,
  fetchAvatars: async () => {
    // If already loaded, don't fetch again
    if (get().avatars.length > 0) return;

    set({ isLoading: true, error: null });
    try {
      // 1. Fetch the projects.json
      const projectsResponse = await fetch(PROJECTS_LIST_URL);
      if (!projectsResponse.ok) throw new Error('Failed to fetch projects list');
      const projects: ProjectEntry[] = await projectsResponse.json();

      // Filter to only include library collections (excludes VIPE, Grifter, etc.)
      const libraryProjects = projects.filter((project) => 
        LIBRARY_COLLECTIONS.includes(project.id)
      );

      const allAvatars: AvatarEntry[] = [];
      const randomAvatars: AvatarEntry[] = [];

      // 2. For each library project, fetch its corresponding avatar_data_file
      const fetchPromises = libraryProjects.map(async (project) => {
        const avatarDataUrl = `${AVATAR_DATA_BASE_URL}${project.avatar_data_file}`;
        const isRandomCollection = RANDOM_COLLECTIONS.includes(project.id);
        
        try {
          const avatarDataResponse = await fetch(avatarDataUrl);
          if (!avatarDataResponse.ok) {
            console.warn(`Failed to fetch avatar data for project ${project.name} from ${avatarDataUrl}`);
            return { avatars: [], isRandom: isRandomCollection };
          }
          const projectAvatars: AvatarEntry[] = await avatarDataResponse.json();
          
          // Filter for VRM avatars only and add collection tag
          const vrmAvatars = Array.isArray(projectAvatars) 
            ? projectAvatars
                .filter((a: any) => a.format === 'VRM' && a.model_file_url)
                .map((a) => ({ ...a, collection: project.id }))
            : [];
            
          return { avatars: vrmAvatars, isRandom: isRandomCollection };
        } catch (innerError) {
          console.error(`Error fetching avatar data for project ${project.name}:`, innerError);
          return { avatars: [], isRandom: isRandomCollection };
        }
      });

      // 3. Wait for all fetches to complete in parallel
      const results = await Promise.all(fetchPromises);
      
      results.forEach(({ avatars, isRandom }) => {
        allAvatars.push(...avatars);
        if (isRandom) {
          randomAvatars.push(...avatars);
        }
      });
      
      // 4. Update the store with all avatars and random pool
      set({ 
        avatars: allAvatars, 
        randomPool: randomAvatars,
        isLoading: false 
      });
      
      console.log(`[AvatarStore] Loaded ${allAvatars.length} avatars (${randomAvatars.length} in random pool)`);

    } catch (err) {
      console.error('Error fetching avatars:', err);
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  getRandomAvatar: () => {
    // Only pick from 100Avatars collection for randomization
    const { randomPool } = get();
    if (randomPool.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * randomPool.length);
    return randomPool[randomIndex];
  }
}));
