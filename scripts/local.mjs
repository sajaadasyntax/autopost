import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

if (!fs.existsSync('.env')) {
  fs.copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example');
}

fs.mkdirSync(path.join(root, 'data'), { recursive: true });
execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', shell: true });
execSync('npm run seed', { stdio: 'inherit', shell: true });

console.log('Local API: http://127.0.0.1:3000');
console.log('In another terminal, run: npm run simulate');

const child = spawn('npm run start:dev', {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
