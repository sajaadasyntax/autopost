const path = require('path');

module.exports = {
  apps: [
    {
      name: 'autopost-web',
      cwd: path.join(__dirname, '..', 'web'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3011',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        NEST_API_URL: 'http://127.0.0.1:3010',
      },
    },
  ],
};
