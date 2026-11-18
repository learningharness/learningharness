/** The runtime sees these ports, never a vendor RPC client or session picker. */
export interface SessionContext { title: string; project: string }
export interface ObserverOptions {
  onEvent(event: unknown): Promise<void>;
  getSeen(sessionId: string): unknown[] | undefined;
  getTaskId(sessionId: string): string | undefined;
  onCheckpoint(sessionId: string, checkpoint: unknown[]): Promise<void>;
}
export interface NativeHost {
  id: string;
  gateway: { generate(input: unknown): Promise<unknown>; cancel(sessionId?: string): Promise<void> | void };
  catalog: Array<{model: string; isDefault?: boolean}>;
  capabilities: Record<string, unknown>;
  presentation: {
    sidebar: 'verified' | 'unverified';
    identity: string;
    entryMetadata(scope: 'global' | 'chat'): Record<string, unknown>;
  };
  connection(sessionId?: string | null): Promise<{connected: boolean; via: string}>;
  getSession(sessionId: string): Promise<SessionContext>;
  createObserver(options: ObserverOptions): { attach(sessionId: string): void; poll(): Promise<void> };
  checkpoint(session: {hostSeen?: unknown[]; codexSeen?: unknown[]}): unknown[] | undefined;
  close(): Promise<void> | void;
}
export function identityFrom(...sources: unknown[]): string | null;
export function validSessionId(id: unknown): id is string;
export function assertNativeHost(host: unknown): NativeHost;
export function nativeCapabilities(id: string, credentialReuse: string): Record<string, unknown>;
export function readinessOutput(event: string): object | null;
export const invitationSignal: string;
