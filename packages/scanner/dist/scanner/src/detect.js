import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
const PACKAGE_SCAN_DEPTH = 2;
const SKIPPED_DIRS = new Set([
    '.git',
    '.next',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'out',
    'vendor',
]);
export async function detectFramework(repoDir) {
    const packageDirs = await findPackageJsonDirs(repoDir, PACKAGE_SCAN_DEPTH);
    const candidates = await Promise.all(packageDirs.map((dir) => evaluateNodeCandidate(repoDir, dir)));
    const bestCandidate = candidates
        .filter((candidate) => candidate !== null)
        .sort((left, right) => right.score - left.score)[0];
    if (bestCandidate) {
        const { score: _score, ...detection } = bestCandidate;
        return detection;
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
                workdir: '.',
            };
        }
        if (lower.includes('flask')) {
            return {
                framework: 'flask',
                runtime: 'python',
                startCommand: 'flask run --host=0.0.0.0 --port=5000',
                port: 5000,
                workdir: '.',
            };
        }
        return {
            framework: 'unknown',
            runtime: 'python',
            startCommand: 'python app.py',
            port: 8000,
            workdir: '.',
        };
    }
    return {
        framework: 'unknown',
        runtime: 'unknown',
        startCommand: '',
        port: 3000,
        workdir: '.',
    };
}
async function findPackageJsonDirs(rootDir, maxDepth) {
    const found = new Set();
    async function walk(dir, depth) {
        if (depth > maxDepth) {
            return;
        }
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        if (entries.some((entry) => entry.isFile() && entry.name === 'package.json')) {
            found.add(dir);
        }
        if (depth === maxDepth) {
            return;
        }
        await Promise.all(entries
            .filter((entry) => entry.isDirectory() && !SKIPPED_DIRS.has(entry.name))
            .map((entry) => walk(join(dir, entry.name), depth + 1)));
    }
    await walk(rootDir, 0);
    return Array.from(found);
}
async function evaluateNodeCandidate(repoDir, packageDir) {
    const packageJson = await readFile(join(packageDir, 'package.json'), 'utf-8').catch(() => null);
    if (packageJson === null) {
        return null;
    }
    let pkg = {};
    try {
        pkg = JSON.parse(packageJson);
    }
    catch {
        return null;
    }
    const deps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
    };
    const scripts = pkg.scripts ?? {};
    const relativeDir = normalizeRelativeDir(repoDir, packageDir);
    const framework = inferNodeFramework(deps, scripts);
    const startCommand = selectStartCommand(framework, scripts);
    if (!startCommand) {
        return null;
    }
    return {
        framework,
        runtime: 'node',
        startCommand,
        port: inferPort(framework, scripts),
        workdir: relativeDir,
        score: scoreCandidate(relativeDir, framework, startCommand, scripts),
    };
}
function inferNodeFramework(deps, scripts) {
    const scriptValues = Object.values(scripts).join(' ').toLowerCase();
    if ('next' in deps || scriptValues.includes('next ')) {
        return 'nextjs';
    }
    if ('react-scripts' in deps || scriptValues.includes('react-scripts')) {
        return 'react';
    }
    if ('vite' in deps || scriptValues.includes('vite')) {
        return 'vite';
    }
    if ('express' in deps) {
        return 'express';
    }
    return 'unknown';
}
function selectStartCommand(framework, scripts) {
    if (framework === 'nextjs' || framework === 'vite') {
        if (scripts.dev)
            return 'npm run dev';
        if (scripts.start)
            return 'npm start';
        if (scripts.preview)
            return 'npm run preview';
    }
    if (framework === 'react') {
        if (scripts.start)
            return 'npm start';
        if (scripts.dev)
            return 'npm run dev';
    }
    if (framework === 'express') {
        if (scripts.start)
            return 'npm start';
        if (scripts.dev)
            return 'npm run dev';
    }
    if (scripts.start)
        return 'npm start';
    if (scripts.preview)
        return 'npm run preview';
    if (scripts.dev)
        return 'npm run dev';
    return '';
}
function inferPort(framework, scripts) {
    const scriptText = `${scripts.start ?? ''} ${scripts.preview ?? ''} ${scripts.dev ?? ''}`;
    const explicitPort = scriptText.match(/(?:--port=|--port\s+|PORT=)(\d{2,5})/i);
    if (explicitPort) {
        return Number(explicitPort[1]);
    }
    if (framework === 'vite')
        return 5173;
    if (framework === 'react' || framework === 'nextjs')
        return 3000;
    if (scriptText.includes('7777'))
        return 7777;
    if (scriptText.includes('8000'))
        return 8000;
    if (scriptText.includes('5000'))
        return 5000;
    return 3000;
}
function scoreCandidate(relativeDir, framework, startCommand, scripts) {
    let score = 0;
    switch (framework) {
        case 'nextjs':
            score += 100;
            break;
        case 'react':
        case 'vite':
            score += 95;
            break;
        case 'express':
            score += 70;
            break;
        default:
            score += 35;
            break;
    }
    if (relativeDir === '.') {
        score += 5;
    }
    if (/(^|[\\/])(frontend|client|web|ui)([\\/]|$)/i.test(relativeDir)) {
        score += 30;
    }
    if (/(^|[\\/])(backend|api|server)([\\/]|$)/i.test(relativeDir)) {
        score -= 10;
    }
    const scriptText = `${scripts.start ?? ''} ${scripts.preview ?? ''} ${scripts.dev ?? ''}`.toLowerCase();
    if (scriptText.includes('cd frontend') || scriptText.includes('cd backend')) {
        score -= 25;
    }
    if (startCommand === 'npm run dev') {
        score += 5;
    }
    return score;
}
function normalizeRelativeDir(rootDir, packageDir) {
    const relativePath = relative(rootDir, packageDir);
    return relativePath === '' ? '.' : relativePath.split(sep).join('/');
}
