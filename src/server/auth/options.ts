import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/lib/logger';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
        });

        if (!user || !user.isActive) {
          logger.warn({ email }, 'auth.login.failed: user not found or inactive');
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          logger.warn({ userId: user.id }, 'auth.login.failed: account locked');
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: { increment: 1 },
              ...(user.failedLoginCount + 1 >= 10 && {
                lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
              }),
            },
          });
          logger.warn({ userId: user.id }, 'auth.login.failed: bad password');
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
};
