import type { AdapterUser } from "next-auth/adapters"

export interface StoredSession {
  id: string
  sessionToken: string
  userId: string
  expires: string
}

export interface StoredUser {
  id: string
  name: string | null
  email: string
  emailVerified: string | null
  image: string | null
  twitterId?: string
  username?: string | null
}

export interface StoredAccount {
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string
  access_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
  id_token?: string
  session_state?: string
}

export interface TwitterAuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error?: string | null
} 