/**
 * Next.js Instrumentation — runs once in the Node.js process at boot.
 * Starts the event dispatcher and background scanners.
 */
export async function register() {
  // Only run on the Node.js runtime (not edge), and not during build
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const { startDispatcher } = await import('@/server/events/dispatcher');
  const { InboxSubscriber, EmailSubscriber } = await import('@/server/modules/notifications');
  const { eventBus } = await import('@/server/events/bus');
  const { startScanners } = await import('@/server/jobs/scanners');

  eventBus.register(new InboxSubscriber());
  eventBus.register(new EmailSubscriber());

  startDispatcher();
  startScanners();
}
