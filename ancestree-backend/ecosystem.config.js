// PM2 Ecosystem Configuration
// This file dynamically loads environment variables from .env file
// so secrets don't need to be committed to version control

const path = require('path');
const fs = require('fs');

// Load .env file manually (dotenv may not be available at PM2 config load time)
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        // Skip empty lines and comments
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        
        // Parse KEY=VALUE format
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          let value = trimmedLine.substring(equalIndex + 1).trim();
          
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          env[key] = value;
        }
      }
    } else {
      console.warn('Warning: .env file not found at', envPath);
    }
  } catch (error) {
    console.error('Error loading .env file:', error.message);
  }
  
  return env;
}

const envVars = loadEnvFile();

module.exports = {
  apps: [{
    name: "ancestree",
    script: "server.js",
    cwd: __dirname,
    
    // Development environment
    env: {
      NODE_ENV: "development",
      PORT: 3001,
      ...envVars
    },
    
    // Production environment (used with: pm2 start ecosystem.config.js --env production)
    env_production: {
      NODE_ENV: "production",
      PORT: 3001,
      ...envVars
    },
    
    // Process management
    instances: 1,
    exec_mode: "fork",
    watch: false,
    
    // Logging
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm Z",
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    log_file: "./logs/combined.log",
    
    // Restart behavior
    max_restarts: 10,
    restart_delay: 1000,
    autorestart: true,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: false
  }]
};
