import React from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

import type { AgentMessage } from '../../global/types';

import { pause } from '../../util/schedulers';

import MessageBubble from '../agent/MessageBubble';

const mockResponseLang = Object.assign((key: string) => key, {
  code: 'ar',
  isRtl: true,
});

jest.mock('../../hooks/useLang', () => ({
  __esModule: true,
  default: () => mockResponseLang,
  LangProvider: ({ children }: { children: unknown }) => children,
  useLangForCode: () => mockResponseLang,
}));

describe('AgentV2IncomingMessage', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.dir = 'ltr';
    document.body.appendChild(root);
  });

  afterEach(() => {
    TeactDOM.render(undefined, root);
    root.remove();
  });

  it('inherits text direction from the interface instead of the response language', async () => {
    TeactDOM.render(
      <MessageBubble
        message={message()}
        isDisabled={false}
      />,
      root,
    );
    await pause(20);

    const response = root.querySelector<HTMLElement>('[lang="ar"]')!;
    expect(response.getAttribute('dir')).toBeNull();
    expect(response.closest('[dir]')).toBe(root);
  });

  it('offers rating buttons on a complete answer only and withdraws the chosen rating on a second press', async () => {
    const onRate = jest.fn();
    TeactDOM.render(
      <>
        <MessageBubble
          message={{ ...message(), id: 1, isComplete: true, feedback: 'like' }}
          isDisabled
          onRate={onRate}
        />
        <MessageBubble message={{ ...message(), id: 2 }} isDisabled={false} onRate={onRate} />
      </>,
      root,
    );
    await pause(20);

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    expect(buttons.map((button) => [button.getAttribute('aria-label'), button.getAttribute('aria-pressed')]))
      .toEqual([['Like', 'true'], ['Dislike', 'false']]);
    buttons[0].click();
    buttons[1].click();
    expect(onRate.mock.calls).toEqual([[1, undefined], [1, 'dislike']]);
  });
});

function message(): AgentMessage {
  return {
    id: 1,
    text: 'Arabic response',
    isOutgoing: false,
    timestamp: Date.now(),
    responseLanguage: 'ar',
    followups: [{ id: 'followup', kind: 'suggested_prompt', text: 'Follow up' }],
  };
}
