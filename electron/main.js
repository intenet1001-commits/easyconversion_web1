const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

let mainWindow;
let nextServer;
// Check if running in packaged app
const isDev = !app.isPackaged;
const port = 9005;

// Check if port is already in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'EasyConversion',
  });

  // Load the app
  const startURL = isDev
    ? `http://localhost:${port}`
    : `http://localhost:${port}`;

  mainWindow.loadURL(startURL);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    let nextDir;
    let command;
    let args;

    if (isDev) {
      // Development mode - use npm
      nextDir = path.join(__dirname, '..');
      command = 'npm';
      args = ['run', 'dev'];
    } else {
      // Production mode - run Next.js server directly with node
      // In packaged app, resources are in app.asar or extracted
      const resourcesPath = process.resourcesPath;

      // Try app.asar.unpacked first, then app
      if (fs.existsSync(path.join(resourcesPath, 'app.asar.unpacked'))) {
        nextDir = path.join(resourcesPath, 'app.asar.unpacked');
      } else {
        nextDir = path.join(resourcesPath, 'app');
      }

      console.log('Resources path:', resourcesPath);
      console.log('Next.js directory:', nextDir);

      // Use Node.js from Electron (not the Electron binary itself)
      // Electron includes Node.js, we need to use 'node' command
      command = 'node';
      args = [
        path.join(nextDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
        'start',
        '-p',
        port.toString()
      ];
    }

    console.log('Starting Next.js server...');
    console.log('Command:', command);
    console.log('Args:', args);
    console.log('CWD:', nextDir);

    nextServer = spawn(command, args, {
      cwd: nextDir,
      shell: false,
      stdio: 'pipe',
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: isDev ? 'development' : 'production',
      }
    });

    nextServer.stdout.on('data', (data) => {
      console.log(`Next.js: ${data}`);
      if (data.toString().includes('Local:') || data.toString().includes('started server')) {
        resolve();
      }
    });

    nextServer.stderr.on('data', (data) => {
      console.error(`Next.js Error: ${data}`);
    });

    nextServer.on('error', (error) => {
      console.error('Failed to start Next.js server:', error);
      reject(error);
    });

    nextServer.on('close', (code) => {
      console.log(`Next.js process exited with code ${code}`);
    });

    // Wait for server to start
    setTimeout(resolve, isDev ? 5000 : 15000);
  });
}

app.on('ready', async () => {
  try {
    // Check if port is already in use (e.g., dev server is running)
    const portInUse = await isPortInUse(port);

    if (portInUse) {
      console.log(`Port ${port} is already in use, skipping server start`);
      // Server is already running, just create window
      createWindow();
    } else {
      // Start the Next.js server
      await startNextServer();
      createWindow();
    }
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (nextServer) {
      nextServer.kill();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill();
  }
});
