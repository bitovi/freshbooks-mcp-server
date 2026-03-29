// PM2 process config — used on the EC2 server
// Start:   pm2 start ecosystem.config.cjs
// Reload:  pm2 reload freshbooks-mcp
// Logs:    pm2 logs freshbooks-mcp

module.exports = {
  apps: [
    {
      name: 'freshbooks-mcp',
      script: './dist/index.js',
      interpreter: 'node',
      // Load .env from the project directory
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        MODE: 'http',
        HTTPS: 'false', // nginx / ALB handles TLS
      },
      // Restart if the process uses more than 512 MB
      max_memory_restart: '512M',
      // Keep logs manageable
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
    },
  ],
};
