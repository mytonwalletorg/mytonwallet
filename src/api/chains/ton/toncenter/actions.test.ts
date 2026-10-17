import {
  activitiesFromSocketMessage,
  fixtures,
  socketMessage,
} from '../../../../../tests/helpers/swapReconcilerFixtures';

describe('parseActionsToActivities', () => {
  it('marks the jetton fee transfer of a swap as our swap fee by the content of its forward payload', () => {
    const activities = activitiesFromSocketMessage(socketMessage(fixtures.case2WsActions, 'finalized'));
    const feeTransfer = activities.find((activity) => activity.kind === 'transaction' && !activity.isIncoming)!;

    expect(feeTransfer.extra?.isOurSwapFee).toBe(true);
    expect(feeTransfer.shouldHide).toBe(true);
  });

  it('names every activity of a trace by the trace id', () => {
    const message = socketMessage(fixtures.case2WsActions, 'finalized');
    const activities = activitiesFromSocketMessage(message);

    expect(activities.map((activity) => activity.kind).sort()).toEqual(['swap', 'transaction']);
    for (const activity of activities) {
      expect(activity.traceId).toBe(message.actions[0].trace_id);
    }
  });

  it('leaves the trace id unknown while the pending trace has none', () => {
    const activities = activitiesFromSocketMessage(socketMessage(fixtures.case2WsActions, 'pending'));

    expect(activities.length).toBeGreaterThan(0);
    for (const activity of activities) {
      expect(activity.traceId).toBeUndefined();
    }
  });
});
