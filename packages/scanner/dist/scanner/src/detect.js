import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function detectFramework(repoDir) {
    const packageJsonPath = join(repoDir, 'package.json');
    const packageJson = await readFile(packageJsonPath, 'utf-8').catch(() => null);
    if (packageJson !== null) {
        let pkg = {};
        try {
            pkg = JSON.parse(packageJson);
        }
        catch {
            pkg = {};
        }
        const deps = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {}),
        };
        const scripts = pkg.scripts ?? {};
        if ('next' in deps) {
            return {
                framework: 'nextjs',
                runtime: 'node',
                startCommand: scripts.start ? 'npm start' : 'npm run build && npm start',
                port: inferPortFromScript(scripts.start ?? scripts.dev, 3000),
            };
        }
        if ('express' in deps) {
            return {
                framework: 'express',
                runtime: 'node',
                startCommand: selectNodeStartCommand(scripts),
                port: inferPortFromScript(scripts.start ?? scripts.dev, 3000),
            };
        }
        const genericStartCommand = selectNodeStartCommand(scripts);
        return {
            framework: 'unknown',
            runtime: 'node',
            startCommand: genericStartCommand,
            port: inferPortFromScript(scripts.start ?? scripts.preview ?? scripts.dev, 3000),
        };
    }
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
                startCommand: 'flask run --host=0.0.0.0 --port=5000',
                port: 5000,
            };
        }
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
function selectNodeStartCommand(scripts) {
    if (scripts.start)
        return 'npm start';
    if (scripts.preview)
        return 'npm run preview';
    if (scripts.dev)
        return 'npm run dev';
    return '';
}
function inferPortFromScript(script, fallback) {
    if (!script) {
        return fallback;
    }
    const explicitPort = script.match(/(?:--port=|--port\s+|PORT=)(\d{2,5})/i);
    if (explicitPort) {
        return Number(explicitPort[1]);
    }
    if (script.includes('vite') || script.includes('preview')) {
        return 4173;
    }
    if (script.includes('next')) {
        return 3000;
    }
    return fallback;
}
