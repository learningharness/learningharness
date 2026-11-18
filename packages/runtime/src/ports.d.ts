// Host bindings implement these ports. No host SDK type crosses into the core.
export interface WorkEvent {
  version?: 1;
  id: string;
  sessionId: string;
  type: string;
  occurredAt?: string;
  data: Record<string, unknown>;
}
// Core-owned prompt boundary. Adapters provide WorkEvent; they do not score,
// summarize or earmark learning opportunities. Changes are captured excerpts.
export interface SelectedWorkUpdate {
  context: { previousWork?: Array<{ id: string; type: string; data: Record<string, unknown> }>; task: string; files: string[]; previousGoals: string[]; tentative: boolean };
  changes: Array<{ id: string; type: string; occurredAt?: string; data: Record<string, unknown> }>;
}
export interface RuntimeCapabilities {
  host: string;
  hostVersion?: string;
  sessionIdentity?: 'stable' | 'connection-scoped';
  observation: { kinds: readonly string[]; publicReasoning?: 'provider-dependent' | 'none'; replay?: boolean };
  model: { independent: boolean; credentialReuse?: string; cancellation?: 'best-effort' | 'none'; usage?: 'measured-or-estimated' | 'none' };
  surface: { experiments: boolean; mindMaps?: boolean; embedded?: boolean; sourceNavigation?: boolean; api?: string };
  persistence?: { scope: string; atomicity: string; crossProcessWriter: boolean };
}
export interface LocalStoragePort {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}
export interface DiagnosticsPort {
  // Local allowlisted timing/count/correlation metadata. No work/learner content.
  record(entry: Record<string, string | number>): void;
}
export interface AnalyticsPort {
  // Optional and best effort. Never pass work content or native session IDs.
  capture(event: string, properties?: Record<string, string | number | boolean>): void;
  setEnabled(enabled: boolean): void;
  status(): { configured: boolean; enabled: boolean; queued?: number; delivered?: number; dropped?: number; failedBatches?: number };
}
export interface ModelPort {
  // Explicit opt-in whole-agent execution; never a raw model-stream capability.
  supportsNativeTools?: boolean;
  generationLimits?(input: { role: 'orchestrator' | 'content-builder'; model: { providerID: string; modelID: string } }): { output: number };
  generate(input: {
    role: 'orchestrator' | 'content-builder'; intent?: string; parentSessionId: string;
    model: { providerID: string; modelID: string }; prompt: string;
    reservation: { input: number; inputBytes: number; output: number };
    execution?: {
      registry: {
        describe(): Array<{ name: string; description: string; inputSchema: unknown; terminal?: boolean }>;
        execute(choice: { tool: string; input: unknown; reason: string }, api: { check(): void; request?: (...args: unknown[]) => Promise<string> }): Promise<{ terminal: boolean; value: unknown }>;
      };
      maxRequests: number;
      timeoutMs: number;
      check(): void;
      request(prompt: string, role?: string, responseSchema?: unknown): Promise<string>;
      onCheckpoint?(state: unknown): Promise<void>;
    };
    onPrepared(sessionId: string): Promise<void>;
  }): Promise<{ text: string; sessionID?: string; usage?: unknown; cycle?: { value: unknown; trace: unknown[] }; executionError?: Error }>;
  sessionModel?(sessionId: string): Promise<{ providerID: string; modelID: string } | null>;
  setContentBuilderModel?(model: { providerID: string; modelID: string } | null): void;
  cancel?(parentSessionId?: string): Promise<void>;
  recoverUsage?(sessionId: string): Promise<unknown>;
}
export interface SurfacePort {
  // Action/status transport is one-way toward the learning runtime. It cannot
  // register work-agent tools or submit text to the coding conversation.
  command(input: { action: string; sessionID?: string; expectedMomentId?: string; value?: unknown }): Promise<unknown>;
  status(input: { sessionID?: string }): Promise<unknown>;
  subscribe(listener: (event: { sessionID?: string; reason: string }) => void): () => void;
}
export interface ObservationPort {
  start(onEvent: (event: WorkEvent) => Promise<void>, signal: AbortSignal): Promise<void>;
}
export interface HostAdapterPorts {
  capabilities: RuntimeCapabilities;
  observations: ObservationPort;
  model: ModelPort;
  storage: LocalStoragePort;
  surface: SurfacePort;
  analytics?: AnalyticsPort;
  diagnostics?: DiagnosticsPort;
}
