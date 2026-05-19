import type { PrismaTransaction } from '@/server/db/client';
import { logger } from '@/server/lib/logger';
import type { Subscriber } from './types';

class EventBus {
  private subscribers: Subscriber[] = [];

  register(sub: Subscriber): void {
    this.subscribers.push(sub);
  }

  /** Emit by writing to the outbox inside an existing transaction. */
  async emit(tx: PrismaTransaction, topic: string, payload: unknown): Promise<void> {
    await tx.eventOutbox.create({ data: { topic, payload: payload as object } });
  }

  /** Called by the dispatcher: fan-out to all matching subscribers. */
  async dispatch(event: { id: string; topic: string; payload: unknown; createdAt: Date; attempts: number }): Promise<void> {
    const matching = this.subscribers.filter((s) => s.topics.includes(event.topic));
    await Promise.all(
      matching.map((s) =>
        s.handle(event).catch((err) => {
          logger.error({ err, topic: event.topic, eventId: event.id }, 'subscriber error');
          throw err;
        }),
      ),
    );
  }
}

export const eventBus = new EventBus();
