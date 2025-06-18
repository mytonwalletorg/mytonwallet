import { createTaskQueue, pause } from './schedulers';

describe('createTaskQueue', () => {
  it.concurrent('limits the concurrency', async () => {
    let runningCount = 0;
    let maxRunningCount = 0;
    let runCount = 0;
    const maxConcurrency = 3;

    const taskQueue = createTaskQueue(maxConcurrency);

    const runTask = taskQueue.wrap(async (lengthMs: number) => {
      runCount++;
      runningCount++;
      maxRunningCount = Math.max(maxRunningCount, runningCount);
      await pause(lengthMs);
      runningCount--;
    });

    await Promise.all([
      runTask(1).then(() => runTask(3)),
      runTask(2).then(() => runTask(4)),
      runTask(3).then(() => runTask(5)),
      runTask(4).then(() => runTask(1)),
      runTask(5),
    ]);

    expect(maxRunningCount).toBe(maxConcurrency);
    expect(runCount).toBe(9);
  });

  it.concurrent('executes the tasks in the input order', async () => {
    const taskOrder: number[] = [];

    const taskQueue = createTaskQueue(2);

    const runTask = taskQueue.wrap(async (index: number, lengthMs: number) => {
      taskOrder.push(index);
      await pause(lengthMs);
    });

    await Promise.all([
      runTask(0, 3),
      runTask(1, 5),
      runTask(2, 6),
      runTask(3, 2),
      runTask(4, 4),
      runTask(5, 3),
      runTask(6, 1),
    ]);

    expect(taskOrder).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it.concurrent('returns the task results', async () => {
    const expectedResults: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: 'result1' },
      { status: 'rejected', reason: new Error('error2') },
      { status: 'fulfilled', value: 'result3' },
    ];

    const taskQueue = createTaskQueue(2);

    const results = await Promise.allSettled(expectedResults.map((result) => {
      return taskQueue.run(async () => {
        await pause(1);
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          throw result.reason;
        }
      });
    }));

    expect(results).toEqual(expectedResults);
  });
});
