import { isAscii } from '../stringFormat';

const MAX_COMMENT_SIZE = 120;

export function isValidLedgerComment(comment: string) {
  return isAscii(comment) && isLedgerCommentLengthValid(comment);
}

export function isLedgerCommentLengthValid(comment: string) {
  return comment.length <= MAX_COMMENT_SIZE;
}
