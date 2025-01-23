import { del, list, put } from '@vercel/blob'

export function createBlobClient(prefix: string) {
  return {
    async get(key: string) {
      const blobs = await list({ prefix: `${prefix}/${key}` })
      if (blobs.blobs.length === 0) return null
      const blob = blobs.blobs[0]
      const response = await fetch(blob.url)
      return response.json()
    },

    async put(key: string, data: any) {
      const { url } = await put(`${prefix}/${key}`, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false
      })
      return url
    },

    async delete(key: string) {
      const blobs = await list({ prefix: `${prefix}/${key}` })
      await Promise.all(blobs.blobs.map(blob => del(blob.url)))
    },

    async list() {
      return list({ prefix })
    }
  }
} 