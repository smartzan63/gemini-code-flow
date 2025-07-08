/**
 * SPARC Command for Gemini Code Flow
 * Adapted from Claude Code Flow by ruvnet
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import { GeminiClient } from '../core/gemini-client';
import { AgentMode } from '../types';
import { Validator, ValidationError } from '../utils/validation';
import { PathSecurity, PathSecurityError } from '../utils/path-security';
import { ErrorHandler } from '../utils/error-handler';

interface SparcOptions {
  file?: string;
  parallel?: string;
  memory?: string;
}

export class SparcCommand {
  async execute(mode: string, task: string, options: SparcOptions): Promise<void> {
    if (!mode || !task) {
      console.log(chalk.red('Usage: gemini-flow sparc <mode> <task>'));
      console.log(chalk.yellow('Example: gemini-flow sparc architect "Design a REST API"'));
      return;
    }

    try {
      // Validate inputs using new validation utility
      const validatedMode = Validator.validateAgentMode(mode);
      const validatedTask = Validator.validateTaskDescription(task);
      
      await this.executeSparc(validatedMode, validatedTask, options);
    } catch (error) {
      if (error instanceof ValidationError) {
        console.log(chalk.red(`Validation Error: ${error.message}`));
        if (error.message.includes('Invalid agent mode')) {
          console.log(chalk.yellow('Run "gemini-flow list" to see available modes'));
        }
      } else {
        console.error(chalk.red('Error:'), ErrorHandler.sanitizeError(error));
      }
    }
  }

  private async executeSparc(mode: AgentMode, task: string, options: SparcOptions): Promise<void> {

    const spinner = ora(`${this.getModeIcon(mode as AgentMode)} Running ${mode} mode...`).start();

    try {
      const client = new GeminiClient();
      const prompt = this.buildSparcPrompt(mode as AgentMode, task);

      let result: string;

      if (options.file) {
        // Use secure path validation
        const resolvedPath = await PathSecurity.resolveSafePath(
          options.file,
          process.cwd(),
          {
            mustExist: true,
            maxSize: 10 * 1024 * 1024, // 10MB
            requireReadable: true
          }
        );
        
        // Check if file type is allowed
        if (!PathSecurity.isAllowedFileType(resolvedPath)) {
          throw new Error(`Unsupported file type: ${options.file}`);
        }
        
        // Multimodal processing
        const fileBuffer = await fs.readFile(resolvedPath);
        const mimeType = PathSecurity.getSafeMimeType(resolvedPath);
        
        result = await client.executeMultimodal(
          prompt,
          [{ mimeType, data: fileBuffer }],
          mode
        );
      } else {
        result = await client.execute(prompt, mode);
      }

      spinner.succeed(`${this.getModeIcon(mode as AgentMode)} ${mode} completed successfully`);
      
      console.log(chalk.cyan('\n📋 Result:\n'));
      console.log(result);
      
      // Save result to file using secure path creation
      const outputDir = await PathSecurity.ensureSafeDirectory('.gemini-flow');
      const outputPath = PathSecurity.createSafeOutputPath(
        outputDir,
        `${mode}-${Date.now()}`,
        '.md'
      );
      
      await fs.writeFile(outputPath, `# ${mode.toUpperCase()} Mode Result\n\n${result}`);
      
      console.log(chalk.gray(`\n💾 Result saved to: ${outputPath}`));

    } catch (error) {
      spinner.fail(`${mode} mode failed`);
      
      if (error instanceof PathSecurityError || error instanceof ValidationError) {
        console.error(chalk.red('Error:'), error.message);
      } else {
        console.error(chalk.red('Error:'), ErrorHandler.sanitizeError(error));
      }
    }
  }

  private buildSparcPrompt(mode: AgentMode, task: string): string {
    const modePrompts = {
      architect: `You are an expert system architect. Design scalable, maintainable solutions using best practices and design patterns.`,
      coder: `You are an expert programmer. Write clean, efficient, and well-documented code following best practices.`,
      tester: `You are a testing specialist. Create comprehensive test cases and implement test-driven development practices.`,
      debugger: `You are a debugging expert. Identify and fix issues systematically, considering root causes and edge cases.`,
      security: `You are a security specialist. Identify vulnerabilities and implement secure coding practices.`,
      documentation: `You are a technical writer. Create clear, comprehensive documentation for developers and users.`,
      integrator: `You are a system integration expert. Connect components and ensure seamless interoperability.`,
      monitor: `You are a monitoring specialist. Implement observability and performance tracking solutions.`,
      optimizer: `You are a performance optimization expert. Improve efficiency and resource utilization.`,
      ask: `You are a task formulation expert. Help clarify requirements and break down complex problems.`,
      devops: `You are a DevOps engineer. Implement deployment, infrastructure, and automation solutions.`,
      tutorial: `You are an educational expert. Create step-by-step learning materials and tutorials.`,
      database: `You are a database administrator. Design and optimize data storage and retrieval systems.`,
      specification: `You are a requirements analyst. Write clear specifications and pseudocode.`,
      mcp: `You are an integration specialist. Connect external services and APIs using MCP protocols.`,
      orchestrator: `You are a workflow orchestrator. Coordinate complex multi-step processes.`,
      designer: `You are a UI/UX designer. Create intuitive and visually appealing user interfaces.`,
    };

    const basePrompt = modePrompts[mode] || modePrompts.coder;

    return `${basePrompt}

## Task Description
${task}

## SPARC Methodology
Please follow the SPARC methodology in your response:

1. **Specification**: Define what needs to be done
2. **Pseudocode**: Outline the approach
3. **Architecture**: Design the solution
4. **Refinement**: Iterate and improve
5. **Completion**: Deliver the final result

Be thorough, systematic, and consider edge cases. Provide practical, actionable solutions.`;
  }

  private getModeIcon(mode: AgentMode): string {
    const icons = {
      architect: '🏗️',
      coder: '🧠',
      tester: '🧪',
      debugger: '🪲',
      security: '🛡️',
      documentation: '📚',
      integrator: '🔗',
      monitor: '📈',
      optimizer: '🧹',
      ask: '❓',
      devops: '🚀',
      tutorial: '📘',
      database: '🔐',
      specification: '📋',
      mcp: '♾️',
      orchestrator: '⚡',
      designer: '🎨',
    };

    return icons[mode] || '🤖';
  }

}