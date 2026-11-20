const path = require('node:path');

const appRoot = process.env.TOAST_ROOT ?? path.join(process.env.HOME ?? '', 'toast');

module.exports = {
  apps: [
    {
      name: 'toast',
      cwd: path.join(appRoot, 'current', 'server'),
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'production',
        CHECKPOINT_DISABLE: '1',
      },
    },
  ],
};
