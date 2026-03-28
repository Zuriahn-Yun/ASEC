'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { insforge } from '@/lib/insforge';

interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  profile?: {
    name?: string;
    avatar_url?: string;
  };
}

interface InsForgeContextType {
  user: User | null;
  isLoaded: boolean;
  signOut: () => Promise<void>;
}

const InsForgeContext = createContext<InsForgeContextType | undefined>(undefined);

export function InsForgeProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await insforge.auth.getCurrentUser();
      setUser(data?.user as User | null);
      setIsLoaded(true);
    };
    fetchUser();
  }, []);

  const signOut = async () => {
    await insforge.auth.signOut();
    setUser(null);
  };

  return (
    <InsForgeContext.Provider value={{ user, isLoaded, signOut }}>
      {children}
    </InsForgeContext.Provider>
  );
}

export function useUser() {
  const context = useContext(InsForgeContext);
  if (context === undefined) {
    throw new Error('useUser must be used within an InsForgeProvider');
  }
  return context;
}
