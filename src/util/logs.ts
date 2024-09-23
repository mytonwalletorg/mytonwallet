import { DEBUG, DEBUG_API } from '../config';
import { omit } from './iteratees';

export function logActionHandling(name: string, payload?: any) {
  if (!DEBUG_API) return;
  if (name === 'apiUpdate') {
    if (typeof payload?.type === 'object' && payload.type !== 'updatingStatus') {
      logDebugApi(`Update: ${payload.type}`, omit(payload, ['type']));
    }
  } else {
    logDebugApi(`Action: ${name}`, payload);
  }
}

export function logDebugError(message: string, ...args: any[]) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.error(`[DEBUG][${message}]`, ...args);
  }
}

export function logDebug(message: any, ...args: any[]) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

export function logDebugApi(message: any, obj1: any, obj2?: any) {
  if (DEBUG_API) {
    // eslint-disable-next-line no-console
    console.debug(`[DEBUG] ${message}`);
    // eslint-disable-next-line no-console
    if (obj1) console.dir(obj1);
    // eslint-disable-next-line no-console
    if (obj2) console.dir(obj2);
  }
}

export function logSelfXssWarnings() {
  const selfXssWarnings: AnyLiteral = {
    en: 'WARNING! This console can be a way for bad people to take over your crypto wallet through something called '
        + 'a Self-XSS attack. So, don\'t put in or paste code you don\'t understand. Stay safe!',
    ru: 'ВНИМАНИЕ! Через эту консоль злоумышленники могут захватить ваш криптовалютный кошелёк с помощью так '
        + 'называемой атаки Self-XSS. Поэтому не вводите и не вставляйте код, который вы не понимаете. Берегите себя!',
    es: '¡ADVERTENCIA! Esta consola puede ser una forma en que las personas malintencionadas se apoderen de su '
        + 'billetera de criptomonedas mediante un ataque llamado Self-XSS. Por lo tanto, '
        + 'no introduzca ni pegue código que no comprenda. ¡Cuídese!',
    zh: '警告！这个控制台可能成为坏人通过所谓的Self-XSS攻击来接管你的加密货币钱包的方式。因此，请不要输入或粘贴您不理解的代码。请保护自己！',
  };

  const langCode = navigator.language.split('-')[0];
  const text = selfXssWarnings[langCode] || selfXssWarnings.en;

  // eslint-disable-next-line no-console
  console.log('%c%s', 'color: red; background: yellow; font-size: 18px;', text);
}
