module.exports = {
  apps: [
    {
      name: 'pickleballer-web',
      cwd: '/var/public/pickleplay/web',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 9001',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
