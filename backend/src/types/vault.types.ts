export interface CreateVaultEntry {
  title: string;
  username?: string;
  password: string;
  url?: string;
  notes?: string;
  category?: 'social' | 'banking' | 'email' | 'work' | 'personal' | 'entertainment' | 'other';
  tags?: string[];
  isFavorite?: boolean;
}

export interface UpdateVaultEntry {
  title?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
}

export interface VaultResponse {
  success: boolean;
  entries?: any[];
  entry?: any;
  error?: string;
}