import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { AgentMode } from '../types';
import { RateLimiter, GEMINI_RATE_LIMITS } from '../utils/rate-limiter';

const exec = promisify(execCb);

export interface GeminiConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** run each request inside tmux session */
  useTmux?: boolean;
  /** directory for temp output files when using tmux */
  tmpDir?: string;
}

export class GeminiClient {
  private config: GeminiConfig;
  private rateLimiter: RateLimiter;
  private dailyRateLimiter: RateLimiter;

  constructor(config: GeminiConfig = {}) {
    this.config = config;
    this.rateLimiter = new RateLimiter(GEMINI_RATE_LIMITS.personal);
    this.dailyRateLimiter = new RateLimiter(GEMINI_RATE_LIMITS.daily);
  }

  async execute(prompt: string, mode: AgentMode): Promise<string> {
    return this.rateLimiter.execute(async () => {
      return this.dailyRateLimiter.execute(async () => {
        if (this.config.useTmux) {
          return this.executeInTmux(prompt);
        }
        return this.executeDirect(prompt);
      });
    });
  }

  async executeMultimodal(
    prompt: string,
    _files: Array<{ mimeType: string; data: Buffer }>,
    mode: AgentMode
  ): Promise<string> {
    // Basic implementation uses text prompt only
    return this.execute(prompt, mode);
  }

  async *streamExecute(prompt: string, _mode: AgentMode): AsyncGenerator<string> {
    await this.rateLimiter.checkLimit();
    await this.dailyRateLimiter.checkLimit();

    const args: string[] = [];
    if (this.config.model) {
      args.push('--model', this.config.model);
    }
    args.push('-p', prompt);

    const child = spawn('gemini', args);

    child.stderr.on('data', () => {}); // suppress

    for await (const chunk of child.stdout) {
      yield chunk.toString();
    }

    await new Promise<void>((resolve, reject) => {
      child.on('close', code => {
        code === 0 ? resolve() : reject(new Error(`Gemini CLI exited with code ${code}`));
      });
      child.on('error', reject);
    });
  }

  private async executeDirect(prompt: string): Promise<string> {
    const args: string[] = [];
    if (this.config.model) {
      args.push('--model', this.config.model);
    }
    args.push('-p', prompt);

    return new Promise((resolve, reject) => {
      const child = spawn('gemini', args);
      let out = '';
      let err = '';
      child.stdout.on('data', d => (out += d.toString()));
      child.stderr.on('data', d => (err += d.toString()));
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) {
          resolve(out.trim());
        } else {
          reject(new Error(`Gemini CLI exited with code ${code}: ${err.trim()}`));
        }
      });
    });
  }

  private async executeInTmux(prompt: string): Promise<string> {
    const session = `gem-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const tmpDir = this.config.tmpDir || os.tmpdir();
    const outputPath = path.join(tmpDir, `${session}.log`);
    const safePrompt = prompt.replace(/"/g, '\"');
    const command = `gemini -p \"${safePrompt}\" > ${outputPath} 2>&1`;
    await exec(`tmux new-session -d -s ${session} "${command}"`);
    // wait for session to finish
    while (true) {
      try {
        await exec(`tmux has-session -t ${session}`);
        await new Promise(res => setTimeout(res, 500));
      } catch {
        break;
      }
    }
    const result = await fs.readFile(outputPath, 'utf8');
    await fs.remove(outputPath);
    return result.trim();
  }

  getRateLimitStatus() {
    return { minute: this.rateLimiter.getStats(), daily: this.dailyRateLimiter.getStats() };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.execute('ping', 'coder');
      return true;
    } catch {
      return false;
    }
  }}
