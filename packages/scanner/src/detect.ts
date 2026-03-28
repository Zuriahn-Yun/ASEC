import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface DetectionResult {
  framework: 'express' | 'nextjs' | 'django' | 'flask' | 'spring' | 'unknown';
  runtime: 'node' | 'python' | 'java' | 'unknown';
  startCommand: string;
  port: number;
}

/**
 * Detects the framework and runtime of a cloned repo.
 * Reads package.json (Node) or requirements.txt (Python) to infer framework.
 */
export async function detectFramework(repoDir: string): Promise<DetectionResult> {
  // Try Node.js detection first
  const packageJsonPath = join(repoDir, 'package.json');
  const packageJson = await readFile(packageJsonPath, 'utf-8').catch(() => null);

  if (packageJson !== null) {
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(packageJson) as Record<string, unknown>;
    } catch {
      pkg = {};
    }

    const deps: Record<string, string> = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };

    if ('next' in deps) {
      return {
        framework: 'nextjs',
        runtime: 'node',
        startCommand: 'npm run build && npm start',
        port: 3000,
      };
    }

    if ('express' in deps) {
      return {
        framework: 'express',
        runtime: 'node',
        startCommand: 'npm start',
        port: 3000,
      };
    }

    // Generic Node app
    return {
      framework: 'unknown',
      runtime: 'node',
      startCommand: 'npm start',
      port: 3000,
    };
  }

  // Try Python detection
  const requirementsPath = join(repoDir, 'requirements.txt');
  const requirements = await readFile(requirementsPath, 'utf-8').catch(() => null);

  if (requirements !== null) {
    const lower = requirements.toLowerCase();

    if (lower.includes('django')) {
      return {
        framework: 'django',
        runtime: 'python',
        startCommand: 'python manage.py runserver 0.0.0.0:8000',
        port: 8000,
      };
    }

    if (lower.includes('flask')) {
      return {
        framework: 'flask',
        runtime: 'python',
        startCommand: 'flask run --host=0.0.0.0',
        port: 5000,
      };
    }

    // Generic Python app
    return {
      framework: 'unknown',
      runtime: 'python',
      startCommand: 'python app.py',
      port: 8000,
    };
  }

  return {
    framework: 'unknown',
    runtime: 'unknown',
    startCommand: '',
    port: 3000,
  };
}
