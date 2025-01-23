import { useState, useEffect } from 'react'
import type { TwitterAuthState } from '@/types/auth'

export function useTwitterAuth() {
  const [authState, setAuthState] = useState<TwitterAuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/twitter/auth/status')
      const { isAuthenticated } = await response.json()
      setAuthState(prev => ({
        ...prev,
        isAuthenticated,
        isLoading: false,
      }))
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check auth status',
      }))
    }
  }

  const login = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      const response = await fetch('/api/twitter/auth')
      const { url } = await response.json()
      if (url) window.location.href = url
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initiate login',
      }))
    }
  }

  const logout = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      await fetch('/api/twitter/auth/logout', { method: 'POST' })
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to logout',
      }))
    }
  }

  return {
    ...authState,
    login,
    logout,
    checkAuthStatus,
  }
} 