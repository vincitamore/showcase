import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Remove .jpg extension if present
    const imageId = params.id.replace(/\.jpg$/, '')

    const image = await prisma.tempImage.findUnique({
      where: { id: imageId }
    })

    if (!image) {
      return new Response('Image not found', { status: 404 })
    }

    // Check if image has expired
    if (image.expiresAt < new Date()) {
      await prisma.tempImage.delete({
        where: { id: imageId }
      })
      return new Response('Image expired', { status: 404 })
    }

    // Always return as JPEG with proper content type
    return new Response(Buffer.from(image.data, 'base64'), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return new Response('Error serving image', { status: 500 })
  }
} 