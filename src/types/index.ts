/**
 * Type definitions for Gemini Code Flow
 * Adapted from Claude Code Flow by ruvnet
 */

export interface Agent {
  id: string;
  mode: AgentMode;
  status: AgentStatus;
  task: string;
  result?: unknown;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export type AgentMode = 
  | 'architect'
  | 'coder'
  | 'tester'
  | 'debugger'
  | 'security'
  | 'documentation'
  | 'integrator'
  | 'monitor'
  | 'optimizer'
  | 'ask'
  | 'devops'
  | 'tutorial'
  | 'database'
  | 'specification'
  | 'mcp'
  | 'orchestrator'
  | 'designer';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SparcMode {
  name: string;
  icon: string;
  description: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  timestamp: Date;
  type: 'knowledge' | 'decision' | 'error' | 'result';
  content: unknown;
  tags: string[];
}

export interface TaskQueue {
  id: string;
  tasks: Task[];
  status: 'active' | 'paused' | 'completed';
}

export interface Task {
  id: string;
  description: string;
  mode: AgentMode;
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];
  status: AgentStatus;
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  retryCount?: number;
}

export interface OrchestratorConfig {
  maxAgents: number;
  memoryPath: string;
  apiKey?: string;
  authMethod?: 'google-account' | 'api-key';
  /** Use gemini CLI instead of API */
  useCli?: boolean;
  modes: Partial<Record<AgentMode, Partial<SparcMode>>>;
}

export interface FileUpload {
  mimeType: string;
  data: Buffer;
}

export interface ConfigFile {
  maxAgents?: number;
  memoryPath?: string;
  authMethod?: 'google-account' | 'api-key';
  apiKey?: string;
  useCli?: boolean;
  modes?: Partial<Record<AgentMode, Partial<SparcMode>>>;}