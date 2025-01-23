import { put, del, list } from '@vercel/blob';
import type { DefaultSession, User, AuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import TwitterProvider from "next-auth/providers/twitter";
import NextAuth from "next-auth";
import { getServerSession } from "next-auth";
import { v4 as uuidv4 } from 'uuid';
import type { StoredSession, StoredUser, StoredAccount } from '@/types/auth';
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession } from "next-auth/adapters";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email: string;
      image?: string | null;
    } & DefaultSession["user"];
    accessToken?: string;
  }
}

const BLOB_PREFIX = 'auth';

// Helper function to convert stored user to adapter user
function storedToAdapterUser(user: StoredUser): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
    name: user.name,
    image: user.image,
  };
}

// Helper function to convert adapter user to stored user
function adapterToStoredUser(user: Partial<AdapterUser> & { id: string; email: string }): StoredUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified?.toISOString() || null,
    name: user.name || null,
    image: user.image || null,
    twitterId: undefined,
    username: undefined,
  };
}

// Helper function to convert stored session to adapter session
function storedToAdapterSession(session: StoredSession): AdapterSession {
  return {
    ...session,
    expires: new Date(session.expires),
  };
}

// Helper function to convert adapter session to stored session
function adapterToStoredSession(session: { sessionToken: string; userId: string; expires: Date }): StoredSession {
  return {
    id: uuidv4(),
    sessionToken: session.sessionToken,
    userId: session.userId,
    expires: session.expires.toISOString(),
  };
}

// Blob Storage Adapter
const BlobAdapter: Adapter = {
  async createUser(user: Omit<AdapterUser, "id">) {
    const id = uuidv4();
    const userData = adapterToStoredUser({ ...user, id });
    await put(`${BLOB_PREFIX}/users/${id}.json`, JSON.stringify(userData), {
      access: 'public',
      addRandomSuffix: false,
    });
    return storedToAdapterUser(userData);
  },

  async getUser(id: string) {
    try {
      const response = await fetch(`${BLOB_PREFIX}/users/${id}.json`);
      if (!response.ok) return null;
      const data = await response.json() as StoredUser;
      return storedToAdapterUser(data);
    } catch {
      return null;
    }
  },

  async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/accounts/` });
    for (const blob of blobs) {
      const response = await fetch(blob.url);
      const account = await response.json() as StoredAccount;
      if (account.provider === provider && account.providerAccountId === providerAccountId) {
        const user = await this.getUser?.(account.userId);
        return user || null;
      }
    }
    return null;
  },

  async getUserByEmail(email: string) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/users/` });
    for (const blob of blobs) {
      const response = await fetch(blob.url);
      const user = await response.json() as StoredUser;
      if (user.email === email) {
        return storedToAdapterUser(user);
      }
    }
    return null;
  },

  async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
    const existingUser = await this.getUser?.(user.id);
    if (!existingUser) throw new Error("User not found");
    
    const updatedUser = adapterToStoredUser({
      ...existingUser,
      ...user,
      id: user.id,
      email: existingUser.email,
    });

    await put(`${BLOB_PREFIX}/users/${user.id}.json`, JSON.stringify(updatedUser), {
      access: 'public',
      addRandomSuffix: false,
    });
    return storedToAdapterUser(updatedUser);
  },

  async linkAccount(account: AdapterAccount) {
    const id = uuidv4();
    await put(`${BLOB_PREFIX}/accounts/${id}.json`, JSON.stringify({ ...account, id }), {
      access: 'public',
      addRandomSuffix: false,
    });
    return account;
  },

  async createSession({ sessionToken, userId, expires }: { sessionToken: string; userId: string; expires: Date }) {
    const sessionData = adapterToStoredSession({ sessionToken, userId, expires });
    await put(`${BLOB_PREFIX}/sessions/${sessionData.id}.json`, JSON.stringify(sessionData), {
      access: 'public',
      addRandomSuffix: false,
    });
    return storedToAdapterSession(sessionData);
  },

  async getSessionAndUser(sessionToken: string) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/sessions/` });
    for (const blob of blobs) {
      const response = await fetch(blob.url);
      const session = await response.json() as StoredSession;
      if (session.sessionToken === sessionToken) {
        const user = await this.getUser?.(session.userId);
        if (!user) return null;
        return {
          session: storedToAdapterSession(session),
          user,
        };
      }
    }
    return null;
  },

  async updateSession({ sessionToken }: { sessionToken: string }) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/sessions/` });
    for (const blob of blobs) {
      const response = await fetch(blob.url);
      const session = await response.json() as StoredSession;
      if (session.sessionToken === sessionToken) {
        const updatedSession = {
          ...session,
          expires: new Date().toISOString(),
        };
        await put(blob.url, JSON.stringify(updatedSession), {
          access: 'public',
          addRandomSuffix: false,
        });
        return storedToAdapterSession(updatedSession);
      }
    }
    return null;
  },

  async deleteSession(sessionToken: string) {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}/sessions/` });
    for (const blob of blobs) {
      const response = await fetch(blob.url);
      const session = await response.json() as StoredSession;
      if (session.sessionToken === sessionToken) {
        await del(blob.url);
        break;
      }
    }
  },

  async deleteUser(userId: string) {
    // Delete user
    await del(`${BLOB_PREFIX}/users/${userId}.json`);
    
    // Delete associated accounts
    const { blobs: accountBlobs } = await list({ prefix: `${BLOB_PREFIX}/accounts/` });
    for (const blob of accountBlobs) {
      const response = await fetch(blob.url);
      const account = await response.json() as StoredAccount;
      if (account.userId === userId) {
        await del(blob.url);
      }
    }
    
    // Delete associated sessions
    const { blobs: sessionBlobs } = await list({ prefix: `${BLOB_PREFIX}/sessions/` });
    for (const blob of sessionBlobs) {
      const response = await fetch(blob.url);
      const session = await response.json() as StoredSession;
      if (session.userId === userId) {
        await del(blob.url);
      }
    }
  },
};

function getTwitterProvider() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("Missing Twitter OAuth credentials");
    }
    console.warn("Warning: Missing Twitter OAuth credentials in development. Authentication will not work.");
    return TwitterProvider({
      clientId: 'placeholder-for-build',
      clientSecret: 'placeholder-for-build',
      version: "2.0",
    });
  }

  return TwitterProvider({
    clientId,
    clientSecret,
    version: "2.0",
  });
}

export const authOptions: AuthOptions = {
  adapter: BlobAdapter,
  providers: [getTwitterProvider()],
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
    signIn: "/",
    error: "/",
  },
  debug: process.env.NODE_ENV === "development",
};

export const getServerAuthSession = () => getServerSession(authOptions); 