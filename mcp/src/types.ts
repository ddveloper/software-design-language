// ── SDL Type Definitions ──────────────────────────────────────────────────────
// Mirrors the SDL JSON Schema spec. These types are used throughout the MCP
// server to give tool handlers full type safety over SDL data.

export interface SdlNode {
  id: string;
  kind: string;
  label: string;
  description?: string;
  responsibilities?: string[];
  exposes?: string[];
  consumes?: string[];
  technology?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface SdlEdge {
  id: string;
  protocol: string;
  source: string;
  target: string;
  label?: string;
  direction?: "unidirectional" | "bidirectional";
  style?: "sync" | "async";
  auth?: {
    mechanism: "none" | "jwt" | "api-key" | "mtls" | "oauth2" | "custom";
  };
  reliability?: {
    delivery?: "at-most-once" | "at-least-once" | "exactly-once";
    retry?: boolean;
    timeout_ms?: number;
    circuit_breaker?: boolean;
  };
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface SdlTrigger {
  id: string;
  kind: string;
  label: string;
  source?: string;
  target?: string;
  schedule?: {
    cron: string;
    timezone?: string;
    description?: string;
  };
  webhook?: {
    provider: string;
    event_type: string;
    verification?: string;
  };
  interaction?: {
    gesture: string;
    element?: string;
    context?: string;
  };
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface SdlStep {
  id: string;
  actor: string;
  action: string;
  via?: string;
  parallel?: boolean;
  condition?: string;
  returns?: string;
  error?: {
    condition?: string;
    handling?: string;
    goto?: string;
  };
  notes?: string;
}

export interface SdlFlow {
  id: string;
  label: string;
  description?: string;
  trigger: string;
  steps: SdlStep[];
  outcome?: {
    success?: string;
    side_effects?: string[];
  };
  continues_async?: Array<{
    flow_ref: string;
    via_event: string;
    condition?: string;
  }>;
  variants?: Array<{
    label: string;
    flow_ref: string;
  }>;
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface SdlManifest {
  sdlVersion: string;
  name?: string;
  description?: string;
}

export interface SdlArchitecture {
  manifest: SdlManifest | null;
  nodes: SdlNode[];
  edges: SdlEdge[];
  triggers: SdlTrigger[];
  flows: SdlFlow[];
}
