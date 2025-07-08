/**
 * Agent Command for Gemini Code Flow
 * Adapted from Claude Code Flow by ruvnet
 */

import chalk from 'chalk';
import ora from 'ora';
import { GeminiClient } from '../core/gemini-client';
import { AgentMode } from '../types';

export class AgentCommand {
  async execute(task: string, options: { mode?: string; stream?: boolean }): Promise<void> {
    const mode = (options.mode || 'coder') as AgentMode;
    const spinner = ora(`🤖 Agent working on task...`).start();

    try {
      const client = new GeminiClient();
      const prompt = `You are an AI assistant in ${mode} mode.

Task: ${task}

Please provide a clear, actionable response. Be concise but thorough.`;

      if (options.stream) {
        spinner.stop();
        console.log(chalk.cyan('🤖 Agent response:\n'));
        
        for await (const chunk of client.streamExecute(prompt, mode)) {
          process.stdout.write(chunk);
        }
        
        console.log('\n');
      } else {
        const result = await client.execute(prompt, mode);
        spinner.succeed('Agent completed task');
        
        console.log(chalk.cyan('\n🤖 Agent response:\n'));
        console.log(result);
      }

    } catch (error) {
      spinner.fail('Agent failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }
}