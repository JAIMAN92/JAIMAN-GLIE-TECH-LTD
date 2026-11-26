import React, { createContext, useContext, useState } from 'react';
import type { SafeAdmin } from '../shared/types.ts';

export interface StudentSessionUser {
  id: number;
  examNumber: string;
  fullName: string;
  classLevel: string;
  arm: string;
  schoolId: number;
  schoolName: string;
  schoolCode: string;
  schoolLogoUrl?: string;
}

interface AuthContextValue {
  adminToken: string | null;
  admin: SafeAdmin | null;
  setAdminSession: (token: string, admin: SafeAdmin) => void;
  updateAdminUser: (admin: SafeAdmin) => void;
  clearAdminSession: () => void;
  studentToken: string | null;
  student: StudentSessionUser | null;
  setStudentSession: (token: string, student: StudentSessionUser) => void;
  clearStudentSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Tokens held strictly in React state memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<SafeAdmin | null>(null);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentSessionUser | null>(null);

  const setAdminSession = (token: string, nextAdmin: SafeAdmin) => {
    setAdminToken(token);
    setAdmin(nextAdmin);
  };

  const updateAdminUser = (nextAdmin: SafeAdmin) => {
    setAdmin(nextAdmin);
  };

  const clearAdminSession = () => {
    setAdminToken(null);
    setAdmin(null);
  };

  const setStudentSession = (
    token: string,
    nextStudent: StudentSessionUser
  ) => {
    setStudentToken(token);
    setStudent(nextStudent);
  };

  const clearStudentSession = () => {
    setStudentToken(null);
    setStudent(null);
  };

  return (
    <AuthContext.Provider
      value={{
        adminToken,
        admin,
        setAdminSession,
        updateAdminUser,
        clearAdminSession,
        studentToken,
        student,
        setStudentSession,
        clearStudentSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
