'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card3D } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

function LoginContent() {
  const router = useRouter()
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/monitoring/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        router.push('/monitoring')
      } else {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Invalid monitoring password provided.'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to authenticate. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter monitoring password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Authenticating...' : 'Access Monitoring'}
      </Button>
    </form>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const error = searchParams?.get('error')
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'Invalid monitoring password provided.'
      })
    }
  }, [searchParams, toast])

  return <LoginContent />
}

export default function MonitoringLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card3D className="w-full max-w-md p-6 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Monitoring Access</h1>
          <p className="text-sm text-muted-foreground">
            Enter the monitoring password to access system metrics and logs
          </p>
        </div>
        <Suspense fallback={
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-5 w-20 bg-muted rounded animate-pulse" />
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
            </div>
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </Card3D>
    </div>
  )
} 