import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthService } from '../services/auth.service';
import { AUTH_ERROR_MESSAGES } from '../utils/constants';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const authService = new AuthService(auth);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthError = (error: any) => {
    console.error('Auth error:', error);
    const errorCode = error?.code || 'default';
    setError(AUTH_ERROR_MESSAGES[errorCode as keyof typeof AUTH_ERROR_MESSAGES] || AUTH_ERROR_MESSAGES.default);
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const user = await authService.signIn(email, password);
      setUser(user);
    } catch (error: any) {
      handleAuthError(error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setError(null);
      const user = await authService.signUp(email, password);
      setUser(user);
    } catch (error: any) {
      handleAuthError(error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await authService.signOut();
      setUser(null);
    } catch (error: any) {
      handleAuthError(error);
      throw error;
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};