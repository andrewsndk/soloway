import { readFileSync, writeFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';

const [archivePath, keyPath, outputPath] = process.argv.slice(2);
if (!archivePath || !keyPath || !outputPath) throw new Error('Usage: node decrypt-backup.mjs <encrypted archive> <local key file> <new output.tar.gz>');
const encrypted = readFileSync(archivePath);
const magic = Buffer.from('SOLOWAY_BACKUP_AES256GCM_V1\n');
if (!encrypted.subarray(0, magic.length).equals(magic)) throw new Error('Unknown backup format');
const key = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'base64');
const iv = encrypted.subarray(magic.length, magic.length + 12);
const tag = encrypted.subarray(magic.length + 12, magic.length + 28);
const cipher = encrypted.subarray(magic.length + 28);
const decrypt = createDecipheriv('aes-256-gcm', key, iv);
decrypt.setAuthTag(tag);
const plaintext = Buffer.concat([decrypt.update(cipher), decrypt.final()]);
writeFileSync(outputPath, plaintext, { mode: 0o600, flag: 'wx' });
console.log('Backup authentication passed; decrypted archive written. No database was changed.');
