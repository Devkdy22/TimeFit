import path from 'path';
import { fileURLToPath } from 'url';
import { getDefaultConfig } from 'expo/metro-config.js';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

export default config;
