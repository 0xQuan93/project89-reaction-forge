import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface EnvironmentProject {
  id: string;
  name: string;
  creator_id: string;
  description: string;
  is_public: boolean;
  license: string;
  source_type: string;
  storage_type: string;
  created_at: string;
  updated_at: string;
  asset_data_file: string;
}

export interface EnvironmentAsset {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  file?: string; // URL to the GLB/GLTF file
  url?: string;  // Alternative URL field
  license?: string;
  author?: string;
}

interface EnvironmentLibraryState {
  projects: EnvironmentProject[];
  selectedProjectId: string | null;
  assets: EnvironmentAsset[];
  isLoadingProjects: boolean;
  isLoadingAssets: boolean;
  error: string | null;
  
  fetchProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
}

const PROJECTS_URL = 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/data/projects.json';
const BASE_URL = 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/data/';

export const useEnvironmentLibraryStore = create<EnvironmentLibraryState>()(
  devtools(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,
      assets: [],
      isLoadingProjects: false,
      isLoadingAssets: false,
      error: null,

      fetchProjects: async () => {
        set({ isLoadingProjects: true, error: null });
        try {
          const response = await fetch(PROJECTS_URL);
          if (!response.ok) throw new Error('Failed to fetch projects');
          
          const projects = await response.json();
          
          // Filter out placeholder/example projects that don't have real data
          const validProjects = projects.filter((p: any) => !p.id.startsWith('example-'));
          
          // Hotfix: Add Momus Park if missing (until added to projects.json)
          if (!validProjects.find((p: any) => p.id === 'pm-momuspark')) {
            validProjects.push({
              id: 'pm-momuspark',
              name: 'Momus Park (Polygonal Mind)',
              creator_id: 'polygonal-mind',
              description: 'Low-poly nature and fantasy park assets.',
              is_public: true,
              license: 'CC0',
              source_type: 'original',
              storage_type: 'github',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              asset_data_file: 'assets/pm-momuspark.json'
            });
          }

          set({ projects: validProjects, isLoadingProjects: false });
        } catch (error) {
          console.error('Failed to fetch environment projects:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load projects', 
            isLoadingProjects: false 
          });
        }
      },

      selectProject: async (projectId: string) => {
        const { projects } = get();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
          set({ error: 'Project not found' });
          return;
        }

        set({ selectedProjectId: projectId, isLoadingAssets: true, error: null, assets: [] });

        try {
          // Construct URL for asset data file
          // Handle both absolute and relative paths
          let url = project.asset_data_file;
          if (!url.startsWith('http')) {
            url = new URL(url, BASE_URL).toString();
          }

          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch assets for ${project.name}`);
          
          const data = await response.json();
          
          // Handle different potential structures of the asset file
          // It might be an array of assets, or an object with an 'assets' property
          let rawAssets: any[] = [];
          if (Array.isArray(data)) {
            rawAssets = data;
          } else if (data.assets && Array.isArray(data.assets)) {
            rawAssets = data.assets;
          } else {
            console.warn('Unknown asset data structure:', data);
          }

          // Resolve URLs
          const assets = rawAssets.map((asset: any) => {
             let fileUrl = asset.file || asset.url;
             if (fileUrl && !fileUrl.startsWith('http')) {
                 // Assume relative to BASE_URL (data folder)
                 fileUrl = new URL(fileUrl, BASE_URL).toString();
             }
             
             let thumbnailUrl = asset.thumbnail || asset.image;
             if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
                 thumbnailUrl = new URL(thumbnailUrl, BASE_URL).toString();
             }

             return {
                 ...asset,
                 file: fileUrl,
                 thumbnail: thumbnailUrl
             };
          });

          set({ assets, isLoadingAssets: false });
        } catch (error) {
          console.error(`Failed to fetch assets for project ${projectId}:`, error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load assets', 
            isLoadingAssets: false 
          });
        }
      },
    }),
    { name: 'EnvironmentLibraryStore' }
  )
);
