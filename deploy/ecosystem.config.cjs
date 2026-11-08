const path = require('path');

module.exports = {
  apps: [
    {
      name: 'autopost',
      cwd: path.join(__dirname, '..'),
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
    },
  ],
};
