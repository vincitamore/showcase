import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { APIError, handleAPIError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger, withLogging } from '@/lib/logger'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

async function handleImageUpload(request: Request): Promise<Response> {
  try {
    const req = request as NextRequest;
    
    logger.info('Processing image upload request', {
      step: 'init',
      url: req.url
    })

    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    
    logger.debug('Checking rate limit', {
      step: 'rate-limit',
      ip
    })

    // Rate limiting check - use a higher limit for uploads
    const isAllowed = await checkRateLimit(ip)
    if (!isAllowed) {
      throw new APIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    logger.debug('Parsing request body', {
      step: 'parse-body'
    })

    // Parse request body
    const body = await req.json().catch(() => {
      throw new APIError('Invalid request body', 400, 'INVALID_REQUEST')
    })

    // Validate image data
    if (!body.image?.data || !body.image?.mime_type) {
      logger.warn('Missing image data or mime type', {
        step: 'validate-data',
        hasData: !!body.image?.data,
        hasMimeType: !!body.image?.mime_type
      })
      throw new APIError('Missing image data or mime type', 400, 'INVALID_IMAGE_DATA')
    }

    logger.debug('Validating image type', {
      step: 'validate-type',
      mimeType: body.image.mime_type,
      allowedTypes: ALLOWED_MIME_TYPES
    })

    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(body.image.mime_type)) {
      throw new APIError(
        `Invalid image type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        400,
        'INVALID_MIME_TYPE'
      )
    }

    // Check image size (base64 is ~4/3 the size of binary)
    const approximateSize = Math.ceil(body.image.data.length * 0.75)

    logger.debug('Checking image size', {
      step: 'check-size',
      approximateSize: `${(approximateSize / (1024 * 1024)).toFixed(2)}MB`,
      maxSize: `${MAX_IMAGE_SIZE / (1024 * 1024)}MB`
    })

    if (approximateSize > MAX_IMAGE_SIZE) {
      throw new APIError(
        `Image too large. Maximum size: ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`,
        400,
        'IMAGE_TOO_LARGE'
      )
    }

    logger.debug('Verifying base64 data', {
      step: 'verify-base64'
    })

    try {
      // Verify base64 data is valid
      Buffer.from(body.image.data, 'base64')
    } catch (error) {
      logger.warn('Invalid base64 data', {
        step: 'base64-error',
        error
      })
      throw new APIError('Invalid base64 image data', 400, 'INVALID_BASE64')
    }
    
    logger.info('Storing image in database', {
      step: 'store-image',
      mimeType: body.image.mime_type,
      approximateSize: `${(approximateSize / (1024 * 1024)).toFixed(2)}MB`
    })

    // Store the image in the database with a TTL
    const storedImage = await prisma.tempImage.create({
      data: {
        data: body.image.data,
        mimeType: 'image/jpeg', // Always store as JPEG
        // Delete after 1 hour
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    }).catch(error => {
      logger.error('Database error while storing image', {
        step: 'store-error',
        error
      })
      throw new APIError('Failed to store image', 500, 'DATABASE_ERROR')
    })

    const imageUrl = `${req.nextUrl.origin}/api/images/${storedImage.id}.jpg`

    logger.info('Image stored successfully', {
      step: 'complete',
      id: storedImage.id,
      url: imageUrl,
      expiresAt: storedImage.expiresAt
    })

    // Return the URL that can be used to access this image
    return new Response(
      JSON.stringify({
        url: imageUrl,
        expiresAt: storedImage.expiresAt
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    )
  } catch (error) {
    logger.error('Image upload failed', {
      step: 'error',
      error
    })
    return handleAPIError(error)
  }
}

export const POST = withLogging(handleImageUpload, 'api/upload') 