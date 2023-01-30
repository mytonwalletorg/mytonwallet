import { pick } from './iteratees';
import { areDeepEqual } from './areDeepEqual';

export default function isPartialDeepEqual<T extends AnyLiteral>(node: T, newPartial: Partial<T>) {
  const currentPartial = pick(node, Object.keys(newPartial) as (keyof typeof newPartial)[]);

  return areDeepEqual(currentPartial, newPartial);
}
