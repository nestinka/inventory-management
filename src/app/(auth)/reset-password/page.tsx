import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="rounded-2xl bg-white px-8 py-10 shadow-lg ring-1 ring-border">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            IN
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invalid link</h1>
        </div>
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
        >
          This reset link is invalid or has expired.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white px-8 py-10 shadow-lg ring-1 ring-border">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
          IN
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
