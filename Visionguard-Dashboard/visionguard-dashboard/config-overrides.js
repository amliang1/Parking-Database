module.exports = function override(config, env) {
  // Add CSV loader
  config.module.rules.push({
    test: /\.csv$/,
    loader: 'file-loader',
    options: {
      name: '[name].[ext]'
    }
  });

  return config;
};
