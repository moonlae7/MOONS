const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const url = 'http://127.0.0.1:3000';
const next = require.resolve('next/dist/bin/next');
console.log('\nMOONS: ' + root + '\nStarting ' + url + '\nKeep this window open while using MOONS.\n');
const server = spawn(process.execPath, [next, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000'], { cwd: root, stdio: 'inherit' });
let opened = false;
const timer = setInterval(() => {
  if (opened) return;
  const request = http.get(url, response => {
    response.resume();
    if (response.statusCode !== 200 || opened) return;
    opened = true;
    clearInterval(timer);
    console.log('\nMOONS is ready: ' + url);
    if (!process.argv.includes('--no-open')) {
      spawn('powershell.exe', ['-NoProfile', '-Command', "Start-Process 'http://127.0.0.1:3000'"], { windowsHide: true, stdio: 'ignore' });
    }
  });
  request.on('error', () => {});
  request.setTimeout(4000, () => request.destroy());
}, 1500);
server.on('error', error => { clearInterval(timer); console.error(error.message); process.exitCode = 1; });
server.on('exit', code => { clearInterval(timer); process.exitCode = code ?? 1; if (code) console.error('\nMOONS could not start. Check the error above.'); });
process.on('SIGINT', () => { clearInterval(timer); server.kill(); });
