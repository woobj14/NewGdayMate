const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts ?? []), 'mjs', 'cjs'],
};

module.exports = config;
