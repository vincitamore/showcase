import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { APIError, handleAPIError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    
    // Rate limiting check - use a higher limit for images
    const isAllowed = await checkRateLimit(ip)
    if (!isAllowed) {
      throw new APIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Remove .jpg extension if present
    const imageId = params.id.replace(/\.jpg$/, '')

    if (!imageId) {
      throw new APIError('Invalid image ID', 400, 'INVALID_IMAGE_ID')
    }

    console.log('[Image API] Serving image:', {
      id: imageId,
      timestamp: new Date().toISOString()
    })

    const image = await prisma.tempImage.findUnique({
      where: { id: imageId }
    })

    if (!image) {
      throw new APIError('Image not found', 404, 'IMAGE_NOT_FOUND')
    }

    // Check if image has expired
    if (image.expiresAt < new Date()) {
      await prisma.tempImage.delete({
        where: { id: imageId }
      }).catch(error => {
        console.error('[Image API] Failed to delete expired image:', {
          id: imageId,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      })
      
      throw new APIError('Image has expired', 404, 'IMAGE_EXPIRED')
    }

    try {
      const imageBuffer = Buffer.from(image.data, 'base64')
      
      // Always return as JPEG with proper content type
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
          'Content-Length': imageBuffer.length.toString()
        }
      })
    } catch (error) {
      console.error('[Image API] Failed to process image data:', {
        id: imageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
      throw new APIError('Failed to process image', 500, 'IMAGE_PROCESSING_ERROR')
    }
  } catch (error) {
    // Special handling for image errors to return proper image error responses
    if (error instanceof APIError) {
      // For 404s, we could optionally return a placeholder image instead
      if (error.statusCode === 404) {
        return new Response(error.message, { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        })
      }
    }
    return handleAPIError(error)
  }
} 