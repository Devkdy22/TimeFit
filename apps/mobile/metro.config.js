import path from 'path';
import { fileURLToPath } from 'url';
import { getDefaultConfig } from 'expo/metro-config.js';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Rive files are binary Metro assets and must be bundled through require().
if (!config.resolver.assetExts.includes('riv')) {
  config.resolver.assetExts.push('riv');
}

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

export default config;
