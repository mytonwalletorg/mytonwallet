import { typify } from '../lib/teact/teactn';
import { GlobalState, ActionPayloads } from './types';

const typed = typify<GlobalState, ActionPayloads>();

export const getGlobal = typed.getGlobal;
export const setGlobal = typed.setGlobal;
export const getActions = typed.getActions;
export const addActionHandler = typed.addActionHandler;
export const withGlobal = typed.withGlobal;
