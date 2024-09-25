import type { Cell, MessageRelaxed } from '@ton/core';
import { beginCell, SendMode, storeMessageRelaxed } from '@ton/core';

export type OutAction = ActionSendMsg;

export class ActionSendMsg {
  public static readonly tag = 0x0ec3c86d;

  public readonly tag = ActionSendMsg.tag;

  constructor(public readonly mode: SendMode, public readonly outMsg: MessageRelaxed) {}

  public serialize(): Cell {
    return beginCell()
      .storeUint(this.tag, 32)
      .storeUint(this.mode || SendMode.IGNORE_ERRORS, 8)
      .storeRef(beginCell().store(storeMessageRelaxed(this.outMsg)).endCell())
      .endCell();
  }
}

function packActionsListOut(actions: OutAction[]): Cell {
  if (actions.length === 0) {
    return beginCell().endCell();
  }

  const [action, ...rest] = actions;

  return beginCell()
    .storeRef(packActionsListOut(rest))
    .storeSlice(action.serialize().beginParse())
    .endCell();
}

function packActionsListExtended(actions: OutAction[]): Cell {
  const outActions: OutAction[] = actions;

  let builder = beginCell();
  if (outActions.length === 0) {
    builder = builder.storeUint(0, 1);
  } else {
    builder = builder.storeMaybeRef(packActionsListOut(outActions.slice().reverse()));
  }
  builder = builder.storeUint(0, 1);
  return builder.endCell();
}

export function packActionsList(actions: OutAction[]): Cell {
  return packActionsListExtended(actions);
}
