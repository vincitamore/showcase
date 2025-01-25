import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const image = await prisma.tempImage.findUnique({
      where: { id: params.id }
    })

    if (!image) {
      return new Response('Image not found', { status: 404 })
    }

    // Check if image has expired
    if (image.expiresAt < new Date()) {
      await prisma.tempImage.delete({
        where: { id: params.id }
      })
      return new Response('Image expired', { status: 404 })
    }

    // Return the image with proper content type
    return new Response(Buffer.from(image.data, 'base64'), {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return new Response('Error serving image', { status: 500 })
  }
} 