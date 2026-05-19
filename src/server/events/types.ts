export interface DomainEvent<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  createdAt: Date;
  attempts: number;
}

export interface Subscriber {
  readonly topics: string[];
  handle(event: DomainEvent): Promise<void>;
}
