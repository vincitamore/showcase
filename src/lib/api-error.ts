import { NextResponse } from 'next/server'
import { env } from '@/env'

export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_SERVER_ERROR'
  ) {
    super(message)
    this.name = 'APIError'
  }
}

interface ErrorResponse {
  error: {
    message: string
    code: string
    details?: unknown
  }
}

export function handleAPIError(error: unknown): NextResponse<ErrorResponse> {
  console.error('[API Error]', {
    error,
    timestamp: new Date().toISOString(),
    stack: error instanceof Error ? error.stack : undefined
  })

  // Handle known API errors
  if (error instanceof APIError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code
        }
      },
      { status: error.statusCode }
    )
  }

  // Handle validation errors
  if (error && typeof error === 'object' && 'code' in error) {
    return NextResponse.json(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error
        }
      },
      { status: 400 }
    )
  }

  // Handle unknown errors
  const message = env.NODE_ENV === 'development' 
    ? error instanceof Error ? error.message : 'An unknown error occurred'
    : 'Internal server error'

  return NextResponse.json(
    {
      error: {
        message,
        code: 'INTERNAL_SERVER_ERROR'
      }
    },
    { status: 500 }
  )
}

export function createAPIRoute(handler: Function) {
  return async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleAPIError(error)
    }
  }
} 