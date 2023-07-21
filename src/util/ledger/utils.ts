import { isAscii } from '../stringFormat';

const MAX_COMMENT_SIZE = 120;

export function isValidLedgerComment(comment: string) {
  return isAscii(comment) && comment.length <= MAX_COMMENT_SIZE;
}
