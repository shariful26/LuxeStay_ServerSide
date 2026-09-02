import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');

/**
 * Reads data from a JSON file in the server/data directory.
 * @param {string} filename 
 * @returns {Array|Object}
 */
export const readData = (filename) => {
  const filePath = path.join(dataDir, filename);
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
};

/**
 * Writes data to a JSON file in the server/data directory.
 * @param {string} filename 
 * @param {any} data 
 * @returns {boolean}
 */
export const writeData = (filename, data) => {
  const filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
};
