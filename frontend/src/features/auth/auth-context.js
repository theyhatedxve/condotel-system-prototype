// Shared context identity, kept separate from the provider component for Fast Refresh.
import {
  createContext,
} from 'react';

export const AuthContext =
  createContext(null);