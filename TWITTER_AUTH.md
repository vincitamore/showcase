# Twitter Authentication Setup

This guide details how to set up Twitter (X.com) authentication in the application using Vercel Blob Storage.

## Prerequisites

1. A Twitter Developer Account
2. Access to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
3. Node.js and pnpm installed
4. Vercel account with Blob Storage enabled

## Required Dependencies

Install the following packages:
```bash
pnpm add next-auth @vercel/blob js-cookie
```

## Storage Configuration

Instead of using Prisma, we'll use Vercel's Blob Storage to store session data and user information. Create the following types in `src/types/auth.ts`:

```typescript
interface StoredSession {
  id: string
  sessionToken: string
  userId: string
  expires: string
}

interface StoredUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  twitterId: string
}

interface StoredAccount {
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string
  access_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
  id_token?: string
  session_state?: string
}
```

## Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Authentication
NEXTAUTH_SECRET="your_nextauth_secret"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"    # Update for production
TWITTER_CLIENT_ID="your_twitter_client_id"
TWITTER_CLIENT_SECRET="your_twitter_client_secret"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="your_blob_read_write_token"

# AI Integration
XAI_API_KEY="your_xai_api_key"

# Real-time Updates (Pusher)
PUSHER_APP_ID="your_pusher_app_id"
PUSHER_SECRET="your_pusher_secret"
NEXT_PUBLIC_PUSHER_KEY="your_pusher_public_key"
NEXT_PUBLIC_PUSHER_CLUSTER="your_pusher_cluster"
```

## Authentication Configuration

1. Create `src/lib/blob-auth.ts`:

```typescript
import { put, del, list, get } from '@vercel/blob';
import type { DefaultSession, User, AuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import TwitterProvider from "next-auth/providers/twitter";
import NextAuth from "next-auth";
import { getServerSession } from "next-auth";
import { v4 as uuidv4 } from 'uuid';

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    } & DefaultSession["user"];
    accessToken?: string;
  }
}

const BLOB_PREFIX = 'auth';

// Blob Storage Adapter
const BlobAdapter = {
  async createUser(user: any) {
    const id = uuidv4();
    const userData = { ...user, id };
    await put(`${BLOB_PREFIX}/users/${id}.json`, JSON.stringify(userData), {
      access: 'private',
    });
    return userData;
  },

  async getUser(id: string) {
    try {
      const { blob } = await get(`${BLOB_PREFIX}/users/${id}.json`);
      return blob ? JSON.parse(await blob.text()) : null;
    } catch {
      return null;
    }
  },

  async getUserByAccount({ provider, providerAccountId }: any) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/accounts/` });
    for (const blob of blobs) {
      const account = JSON.parse(await (await get(blob.url)).blob.text());
      if (account.provider === provider && account.providerAccountId === providerAccountId) {
        return this.getUser(account.userId);
      }
    }
    return null;
  },

  async updateUser(user: any) {
    await put(`${BLOB_PREFIX}/users/${user.id}.json`, JSON.stringify(user), {
      access: 'private',
    });
    return user;
  },

  async linkAccount(account: any) {
    const id = uuidv4();
    await put(`${BLOB_PREFIX}/accounts/${id}.json`, JSON.stringify({ ...account, id }), {
      access: 'private',
    });
    return account;
  },

  async createSession(session: any) {
    const id = uuidv4();
    await put(`${BLOB_PREFIX}/sessions/${id}.json`, JSON.stringify({ ...session, id }), {
      access: 'private',
    });
    return session;
  },

  async getSessionAndUser(sessionToken: string) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/sessions/` });
    for (const blob of blobs) {
      const session = JSON.parse(await (await get(blob.url)).blob.text());
      if (session.sessionToken === sessionToken) {
        const user = await this.getUser(session.userId);
        return { session, user };
      }
    }
    return null;
  },

  async updateSession(session: any) {
    await put(`${BLOB_PREFIX}/sessions/${session.id}.json`, JSON.stringify(session), {
      access: 'private',
    });
    return session;
  },

  async deleteSession(sessionToken: string) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/sessions/` });
    for (const blob of blobs) {
      const session = JSON.parse(await (await get(blob.url)).blob.text());
      if (session.sessionToken === sessionToken) {
        await del(blob.url);
        break;
      }
    }
  },
};

if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET) {
  throw new Error("Missing Twitter OAuth credentials");
}

export const authOptions: AuthOptions = {
  adapter: BlobAdapter,
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: User | undefined }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (session?.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  debug: process.env.NODE_ENV === "development",
};

export const getServerAuthSession = () => getServerSession(authOptions);
```

2. Update `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { authOptions } from "@/lib/blob-auth"
import NextAuth from "next-auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

3. Update `src/auth.ts`:

```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/lib/blob-auth"

export const { auth } = NextAuth(authOptions)
```

## Middleware Configuration

Create or update `middleware.ts` in your project root:

```typescript
import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/chat-connections/:path*",
  ],
};
```

## Client Components

The client components remain the same as they interact with NextAuth.js's interface, which remains unchanged despite the storage backend change.

## Twitter Developer Portal Setup

1. Go to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app
3. Enable OAuth 2.0 settings
4. Set the callback URL to `http://localhost:3000/api/auth/callback/twitter` for development
5. Copy the Client ID and Client Secret to your `.env` file

## Security Notes

1. Always keep your environment variables secure and never commit them to version control
2. Use middleware to protect routes that require authentication
3. Validate user sessions on the server side for all protected API routes
4. Implement proper error handling for authentication failures
5. Consider implementing rate limiting for auth-related endpoints
6. Ensure Vercel Blob Storage access is properly secured with appropriate tokens

## Environment Variables Generation

Here's how to generate or obtain each required environment variable:

1. **NEXTAUTH_SECRET**: Generate using the command: `openssl rand -base64 32`
2. **NEXTAUTH_URL**: 
   - Development: `http://localhost:3000`
   - Production: Your deployed application URL
3. **TWITTER_CLIENT_ID** and **TWITTER_CLIENT_SECRET**: Obtain from the Twitter Developer Portal
4. **BLOB_READ_WRITE_TOKEN**: Generate from your Vercel project settings
5. **XAI_API_KEY**: Obtain from the xAI platform
6. **PUSHER_** variables: Create a Pusher account and get the credentials from your dashboard

Remember to update these variables for each environment (development, staging, production).

## Migration from Prisma

If you're migrating from Prisma to Blob Storage:

1. Export your existing user data from Prisma
2. Convert the data to the new blob storage format
3. Use the provided migration script in `scripts/migrate-auth-to-blob.ts`
4. Verify data integrity after migration
5. Keep Prisma running in parallel during the migration period
6. Switch to blob storage once migration is complete

## Performance Considerations

1. Blob storage operations are atomic but may have higher latency than Prisma
2. Implement appropriate caching strategies for frequently accessed data
3. Use bulk operations when possible to reduce API calls
4. Monitor blob storage usage and implement cleanup routines
5. Consider implementing a fallback mechanism for critical auth operations 