// Types for the Cursor Cloud Agents API.
// v1 (beta) is used for launching, runs, streaming and artifacts.
// v0 (legacy) is used where v1 has no equivalent yet: the rich agent list and the
// full conversation transcript.

export type ApiKeyInfo = {
  apiKeyName: string;
  createdAt: string;
  userId?: number;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
};

export type ModelParam = { id: string; value: string };

export type ModelListItem = {
  id: string;
  displayName: string;
  description?: string;
  aliases?: string[];
  parameters?: {
    id: string;
    displayName?: string;
    values: { value: string; displayName?: string }[];
  }[];
  variants?: { params: ModelParam[]; displayName: string; description?: string; isDefault?: boolean }[];
};

export type Repository = { url: string };

export type ImageInput = { data: string; mimeType: string } | { url: string };

export type AgentMode = 'agent' | 'plan';

export type CreateAgentRequest = {
  prompt: { text: string; images?: ImageInput[] };
  model?: { id: string; params?: ModelParam[] };
  name?: string;
  repos?: { url: string; startingRef?: string; prUrl?: string }[];
  workOnCurrentBranch?: boolean;
  autoCreatePR?: boolean;
  mode?: AgentMode;
};

export type AgentV1 = {
  id: string;
  name?: string;
  status: 'ACTIVE' | 'IDLE' | 'ARCHIVED';
  env: { type: 'cloud' | 'pool' | 'machine'; name?: string };
  url: string;
  createdAt: string;
  updatedAt: string;
  latestRunId?: string;
  repos?: { url: string; startingRef?: string; prUrl?: string }[];
  autoCreatePR?: boolean;
};

export type RunStatus =
  | 'CREATING'
  | 'RUNNING'
  | 'WAITING_FOR_BACKGROUND_WORK'
  | 'FINISHED'
  | 'ERROR'
  | 'CANCELLED'
  | 'EXPIRED';

export type GitBranch = { repoUrl: string; branch?: string; prUrl?: string };

export type Run = {
  id: string;
  agentId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  result?: string;
  git?: { branches: GitBranch[] };
};

export type CreateAgentResponse = { agent: AgentV1; run: Run };

export type Artifact = { path: string; sizeBytes: number; updatedAt: string };

// ---- v0 ----

export type AgentStatusV0 = 'CREATING' | 'RUNNING' | 'FINISHED' | 'ERROR' | 'EXPIRED' | string;

export type AgentV0 = {
  id: string;
  name: string;
  status: AgentStatusV0;
  source?: { repository?: string; ref?: string };
  target?: {
    branchName?: string;
    url?: string;
    prUrl?: string;
    autoCreatePr?: boolean;
  };
  summary?: string;
  createdAt: string;
  /** Merged in from the v1 list (v0 has no updatedAt). */
  updatedAt?: string;
};

export type ConversationMessage = {
  id: string;
  type: 'user_message' | 'assistant_message';
  text: string;
};

// ---- streaming ----

export type ToolCallEvent = {
  callId: string;
  name: string;
  status: 'running' | 'completed';
  args?: unknown;
  result?: unknown;
  truncated?: { args?: true; result?: true };
};

export type StreamEvent =
  | { type: 'status'; data: { runId?: string; agentId?: string; status: RunStatus } }
  | { type: 'assistant'; data: { text: string } }
  | { type: 'thinking'; data: { text: string } }
  | { type: 'tool_call'; data: ToolCallEvent }
  | { type: 'result'; data: { runId: string; status: RunStatus; text?: string; durationMs?: number } }
  | { type: 'error'; data: { code: string; message: string } }
  | { type: 'done'; data: Record<string, never> }
  | { type: 'heartbeat'; data: Record<string, never> };
