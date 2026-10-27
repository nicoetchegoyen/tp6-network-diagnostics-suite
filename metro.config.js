const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
const escapedRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[\\/]\.cache[\\/]/,
  /[\\/]\.tools[\\/]/,
  /[\\/]tmp[\\/]/,
  /[\\/]deliverables[\\/]/,
  new RegExp(`^${escapedRoot}[\\\\/]legacy[\\\\/]`),
];
config.maxWorkers = 2;
module.exports = config;
