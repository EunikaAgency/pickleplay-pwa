module.exports = {
  apps: [
    {
      name: 'pickleplay-pwa',
      cwd: '/var/public/pickleplay/app',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 9000',
      env: {
        NODE_ENV: 'production',
      },
      watch: ['src', 'index.html', 'vite.config.ts'],
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'dist'],
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
}
