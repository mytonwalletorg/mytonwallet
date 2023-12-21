let counter = 0;

export function disableSwipeToClose() {
  counter += 1;
}

export function enableSwipeToClose() {
  counter -= 1;
}

export function getIsSwipeToCloseDisabled() {
  return counter > 0;
}
