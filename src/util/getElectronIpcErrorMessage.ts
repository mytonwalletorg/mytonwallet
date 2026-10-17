// `ipcRenderer.invoke` rethrows main-process errors as "Error invoking remote method '<channel>': Error: <message>".
// We strip that prefix so known errors like "Canceled by the user" can be matched and translated.
const IPC_ERROR_PREFIX_REGEX = /^Error invoking remote method '[^']*': Error: /;

export default function getElectronIpcErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.replace(IPC_ERROR_PREFIX_REGEX, '');
}
