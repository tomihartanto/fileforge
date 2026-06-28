export default {
  webpack: (config, { isServer }) => {
    if (isServer) {
      if (!Array.isArray(config.externals)) {
        config.externals = [];
      }
      config.externals.push({ '@napi-rs/canvas': '@napi-rs/canvas' });
    }
    return config;
  },
};
