import { create } from 'zustand';

export type AvatarEntry = {
  id: string;
  name: string;
  description: string;
  model_file_url: string;
  format: string;
  thumbnail_url: string;
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
  avatars: AvatarEntry[];
  isLoading: boolean;
  error: string | null;
  fetchAvatars: () => Promise<void>;
  getRandomAvatar: () => AvatarEntry | null;
};

// Updated URL to fetch projects.json
const PROJECTS_LIST_URL = 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/projects.json';
const AVATAR_DATA_BASE_URL = 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/';

export const useAvatarListStore = create<AvatarListState>((set, get) => ({
  avatars: [],
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

      const allAvatars: AvatarEntry[] = [];

      // 2. For each project, fetch its corresponding avatar_data_file
      const fetchPromises = projects.map(async (project) => {
        const avatarDataUrl = `${AVATAR_DATA_BASE_URL}${project.avatar_data_file}`;
        
        try {
          const avatarDataResponse = await fetch(avatarDataUrl);
          if (!avatarDataResponse.ok) {
            console.warn(`Failed to fetch avatar data for project ${project.name} from ${avatarDataUrl}`);
            return [];
          }
          const projectAvatars: AvatarEntry[] = await avatarDataResponse.json();
          
          // Filter for VRM avatars only
          return Array.isArray(projectAvatars) 
            ? projectAvatars.filter((a: any) => a.format === 'VRM' && a.model_file_url)
            : [];
        } catch (innerError) {
          console.error(`Error fetching avatar data for project ${project.name}:`, innerError);
          return [];
        }
      });

      // 3. Wait for all fetches to complete in parallel
      const avatarArrays = await Promise.all(fetchPromises);
      avatarArrays.forEach((avatars) => allAvatars.push(...avatars));
      
      // 4. Update the store with all combined VRM avatars
      set({ avatars: allAvatars, isLoading: false });

    } catch (err) {
      console.error('Error fetching avatars:', err);
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  getRandomAvatar: () => {
    const { avatars } = get();
    if (avatars.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * avatars.length);
    return avatars[randomIndex];
  }
}));
