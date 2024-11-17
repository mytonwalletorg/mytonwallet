import { isAscii } from '../stringFormat';

const MAX_COMMENT_SIZE = 120;
const BROKEN_CONNECTION_ERRORS = new Set(['DisconnectedDeviceDuringOperation', 'TransportRaceCondition']);

export function isValidLedgerComment(comment: string) {
  return isAscii(comment) && isLedgerCommentLengthValid(comment);
}

export function isLedgerCommentLengthValid(comment: string) {
  return comment.length <= MAX_COMMENT_SIZE;
}

export function isLedgerConnectionBroken(error: string) {
  return BROKEN_CONNECTION_ERRORS.has(error);
}
