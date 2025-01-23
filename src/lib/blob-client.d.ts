export interface BlobClient {
  get(key: string): Promise<any | null>
  put(key: string, data: any): Promise<string>
  delete(key: string): Promise<void>
  list(): Promise<{ blobs: Array<{ url: string }> }>
}

export function createBlobClient(prefix: string): BlobClient 