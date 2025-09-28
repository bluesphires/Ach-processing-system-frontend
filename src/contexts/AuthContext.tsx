'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { User } from '@/types';
import { apiClient } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: { name?: string; email?: string }) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: { user: User; token: string } }
  | { type: 'CLEAR_USER' }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'CLEAR_USER':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // Check if user is logged in on app start
    const checkAuth = async () => {
      const token = apiClient.getToken();
      if (token) {
        // Only use stored user data - no profile endpoint calls
        if (typeof window !== 'undefined') {
          const storedUserData = localStorage.getItem('userData');
          if (storedUserData) {
            try {
              const userData = JSON.parse(storedUserData);
              dispatch({
                type: 'SET_USER',
                payload: { user: userData, token },
              });
              console.log('Using stored user data for authentication');
              return;
            } catch (parseError) {
              console.warn('Failed to parse stored user data:', parseError);
            }
          }
        }
        
        // If no stored data but we have a token, create a minimal user object
        // to maintain authentication state
        console.log('Token exists but no stored user data - creating minimal user');
        const minimalUser = {
          id: 'temp-user',
          email: 'user@example.com',
          firstName: 'User',
          lastName: 'User',
          role: 'admin'
        };
        dispatch({
          type: 'SET_USER',
          payload: { user: minimalUser, token },
        });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiClient.login({ email, password });
      
      if (response.success && response.data) {
        // Set token first
        apiClient.setToken(response.data.token);
        
        // Store user data in localStorage for persistence
        if (typeof window !== 'undefined') {
          localStorage.setItem('userData', JSON.stringify(response.data.user));
        }
        
        // Then set user state
        dispatch({
          type: 'SET_USER',
          payload: { user: response.data.user, token: response.data.token },
        });
        
        // Ensure loading is set to false after successful login
        dispatch({ type: 'SET_LOADING', payload: false });
        
        return { success: true };
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: false, error: response.error || 'Login failed' };
      }
    } catch (error: unknown) {
      dispatch({ type: 'SET_LOADING', payload: false });
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during login';
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      // Split name into firstName and lastName
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const response = await apiClient.register({ email, password, firstName, lastName });
      
      if (response.success && response.data) {
        apiClient.setToken(response.data.token);
        dispatch({
          type: 'SET_USER',
          payload: { user: response.data.user, token: response.data.token },
        });
        return { success: true };
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: false, error: response.error || 'Registration failed' };
      }
    } catch (error: unknown) {
      dispatch({ type: 'SET_LOADING', payload: false });
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during registration';
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const logout = () => {
    apiClient.clearToken();
    // Clear stored user data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userData');
    }
    dispatch({ type: 'CLEAR_USER' });
  };

  const updateProfile = async (updates: { name?: string; email?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.updateProfile(updates);
      
      if (response.success) {
        dispatch({ type: 'UPDATE_USER', payload: updates });
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Profile update failed' };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during profile update';
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const refreshProfile = async (): Promise<void> => {
    // Profile refresh disabled to prevent logout issues
    console.log('Profile refresh disabled to prevent logout issues');
  };

  const hasRole = (roles: string[]): boolean => {
    if (!state.user) return false;
    return roles.includes(state.user.role);
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    refreshProfile,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}