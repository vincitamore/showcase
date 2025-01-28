import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { APIError, handleAPIError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger, withLogging } from '@/lib/logger'

async function handleImageRetrieval(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const req = request as NextRequest;
    
    logger.info('Processing image retrieval request', {
      step: 'init',
      url: req.url,
      imageId: params.id
    })

    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    
    logger.debug('Checking rate limit', {
      step: 'rate-limit',
      ip
    })

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

    logger.debug('Retrieving image from database', {
      step: 'fetch-image',
      imageId
    })

    const image = await prisma.tempImage.findUnique({
      where: { id: imageId }
    })

    if (!image) {
      logger.warn('Image not found', {
        step: 'not-found',
        imageId
      })
      throw new APIError('Image not found', 404, 'IMAGE_NOT_FOUND')
    }

    // Check if image has expired
    if (image.expiresAt < new Date()) {
      logger.info('Deleting expired image', {
        step: 'delete-expired',
        imageId,
        expiresAt: image.expiresAt
      })

      await prisma.tempImage.delete({
        where: { id: imageId }
      }).catch(error => {
        logger.error('Failed to delete expired image', {
          step: 'delete-error',
          imageId,
          error
        })
      })
      
      throw new APIError('Image has expired', 404, 'IMAGE_EXPIRED')
    }

    try {
      logger.debug('Processing image data', {
        step: 'process-image',
        imageId,
        mimeType: image.mimeType
      })

      const imageBuffer = Buffer.from(image.data, 'base64')
      
      logger.info('Image served successfully', {
        step: 'complete',
        imageId,
        size: imageBuffer.length
      })

      // Always return as JPEG with proper content type
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
          'Content-Length': imageBuffer.length.toString()
        }
      })
    } catch (error) {
      logger.error('Failed to process image data', {
        step: 'process-error',
        imageId,
        error
      })
      throw new APIError('Failed to process image', 500, 'IMAGE_PROCESSING_ERROR')
    }
  } catch (error) {
    logger.error('Image retrieval failed', {
      step: 'error',
      error,
      imageId: params.id
    })

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

export const GET = withLogging(handleImageRetrieval, 'api/images/[id]') 