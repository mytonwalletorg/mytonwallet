import { randomBytes } from '../../util/random';
import { storage } from '../storages';

let clientId: string | undefined;

export async function getClientId() {
  clientId = await storage.getItem('clientId');
  if (!clientId) {
    clientId = Buffer.from(randomBytes(10)).toString('hex');
    await storage.setItem('clientId', clientId);
  }
  return clientId;
}
