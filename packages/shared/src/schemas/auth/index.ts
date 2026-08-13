import { z } from 'zod';
import { UserRole, UserStatus } from '../../types';

// Login
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// User response (public, no password hash)
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

// Auth response after login
export const authResponseSchema = z.object({
  user: userResponseSchema,
  message: z.string(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
