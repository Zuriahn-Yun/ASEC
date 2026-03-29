'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { insforge, clearAccessToken, hasStoredAccessToken } from '@/lib/insforge';

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
    let cancelled = false;

    const fetchUser = async () => {
      if (!hasStoredAccessToken()) {
        if (!cancelled) {
          setUser(null);
          setIsLoaded(true);
        }
        return;
      }

      try {
        const { data, error } = await insforge.auth.getCurrentUser();

        if (cancelled) {
          return;
        }

        if (error) {
          clearAccessToken();
          setUser(null);
        } else {
          setUser(data?.user as User | null);
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    };

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    await insforge.auth.signOut();
    clearAccessToken();
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
