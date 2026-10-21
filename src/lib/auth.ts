import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      email: string;
      name: string;
    };
  }

  interface User {
    id: string;
    role: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password harus diisi");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.isActive) {
          throw new Error("Email tidak ditemukan atau akun tidak aktif");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Password salah");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      } else if (token.id && !token.role) {
        // Fallback: Jika token.role kosong (misal karena session lama), ambil dari database
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
          }
        } catch (error) {
          console.error("Error fetching user role in jwt callback:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const nextAuthInstance = NextAuth(authConfig);
export const { handlers, signIn, signOut } = nextAuthInstance;

/**
 * Enhanced auth() helper:
 * 1. Supports NextAuth middleware when called with a callback: auth((req) => ...)
 * 2. In Server Components, Server Actions, and Route Handlers:
 *    - First checks standard NextAuth web session
 *    - If null, checks Authorization Bearer header or authjs.session-token cookie
 *      and validates mobile JWT token via verifyMobileToken()
 */
export const auth: typeof nextAuthInstance.auth = ((...args: any[]) => {
  // If called as middleware wrapper (function argument)
  if (typeof args[0] === "function") {
    return (nextAuthInstance.auth as any)(...args);
  }

  // If called directly: await auth()
  return (async () => {
    try {
      const session = await (nextAuthInstance.auth as any)();
      if (session?.user?.id) {
        if (session.user.role) {
          session.user.role = session.user.role.toUpperCase();
        }
        return session;
      }
    } catch {
      // Standard NextAuth failed or not present
    }

    try {
      const { headers } = await import("next/headers");
      const reqHeaders = await headers();
      let token: string | null = null;

      const authHeader = reqHeaders.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }

      if (!token) {
        const cookieHeader = reqHeaders.get("cookie");
        if (cookieHeader) {
          const match = cookieHeader.match(/(?:__Secure-)?authjs\.session-token=([^;]+)/);
          if (match) token = match[1];
        }
      }

      if (token) {
        const { verifyMobileToken } = await import("@/lib/utils/jwt");
        const payload = verifyMobileToken(token);
        if (payload) {
          return {
            user: {
              id: payload.id,
              email: payload.email,
              name: payload.name,
              role: (payload.role || "KASIR").toUpperCase(),
            },
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          } as any;
        }
      }
    } catch {
      // headers() context not available or error occurred
    }

    return null;
  })();
}) as any;

export const getCurrentUser = async () => {
  const session = await auth();
  return session?.user;
};