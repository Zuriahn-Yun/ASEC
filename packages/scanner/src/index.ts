// Scanner pipeline entry point
export { runPipeline } from './orchestrator.js';
export { cloneRepo } from './clone.js';
export { detectFramework } from './detect.js';
export type { DetectionResult } from './detect.js';
export { bootApp, stopApp } from './boot.js';
export { cleanup } from './cleanup.js';
