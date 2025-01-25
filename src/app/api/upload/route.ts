import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()
    
    // Store the image in the database with a TTL
    const storedImage = await prisma.tempImage.create({
      data: {
        data: image.data,
        mimeType: image.mime_type,
        // Delete after 1 hour
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    })

    // Return the URL that can be used to access this image
    return new Response(
      JSON.stringify({
        url: `${req.nextUrl.origin}/api/images/${storedImage.id}`
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error storing image:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to store image' }),
      { status: 500 }
    )
  }
} 