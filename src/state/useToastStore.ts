import { useToast } from '../ui/Toast';

// Re-export the store hook for backward compatibility
// The new store implementation in ../ui/Toast.tsx includes addToast/removeToast aliases
// and handles the state management.
export const useToastStore = useToast;

// Re-export types if needed (though consumers usually infer them)
export type { Toast } from '../ui/Toast';
