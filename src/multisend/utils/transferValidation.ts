import { Address } from '@ton/core';

import { isDnsDomain } from '../../util/dns';
import safeExec from '../../util/safeExec';
import { trimStringByMaxBytes } from '../../util/text';
import withCache from '../../util/withCache';
import { resolveAddress } from '../../api/chains/ton/address';
import { findTokenInfo } from './tokens';

interface TransferRow {
  receiver: string;
  amount: string;
  tokenIdentifier: string;
  comment?: string;
  resolvedTokenInfo?: { tokenAddress: string; symbol: string; name: string; decimals: number };
  resolvedAddress?: string;
}

const resolveAddressWithCache = withCache(resolveAddress);

export function isTonIdentifier(identifier: string): boolean {
  const lower = identifier.toLowerCase();
  return lower === 'ton' || lower === 'toncoin';
}

async function validateTokenIdentifier(tokenIdentifier: string): Promise<{
  isValid: boolean;
  error?: string;
  tokenInfo?: { tokenAddress: string; symbol: string; name: string; decimals: number };
}> {
  if (isTonIdentifier(tokenIdentifier)) {
    return { isValid: true };
  }

  try {
    const tokenInfo = await findTokenInfo(tokenIdentifier);
    if (!tokenInfo) {
      return {
        isValid: false,
        error: safeExec(() => Address.parse(tokenIdentifier))
          ? `Token not found for address "${tokenIdentifier}". Please verify the token address is correct.`
          : `Invalid token identifier "${tokenIdentifier}". Please use a valid token name, symbol, or minter address.`,
      };
    }

    if (!safeExec(() => Address.parse(tokenInfo.tokenAddress))) {
      return {
        isValid: false,
        error: `Invalid token address format for "${tokenIdentifier}".`,
      };
    }

    return { isValid: true, tokenInfo };
  } catch (err: any) {
    return {
      isValid: false,
      error: err?.message || 'Failed to validate token',
    };
  }
}

function isValidAmount(amount: string): boolean {
  const numAmount = Number(amount);
  return !Number.isNaN(numAmount) && numAmount > 0;
}

export async function validateAndProcessTransfer(transfer: {
  receiver: string;
  amount: string;
  tokenIdentifier: string;
  comment?: string;
}): Promise<{
    isValid: boolean;
    error?: string;
    processedTransfer?: TransferRow;
  }> {
  const { receiver, amount, tokenIdentifier, comment } = transfer;

  // Validate and resolve receiver address
  let resolvedReceiverAddress = receiver;
  if (isDnsDomain(receiver)) {
    try {
      const network = 'mainnet';
      const resolveResult = await resolveAddressWithCache(network, receiver);

      if (resolveResult === 'dnsNotResolved') {
        return {
          isValid: false,
          error: `Could not resolve TON domain: ${receiver}. Please check if the domain is valid and exists.`,
        };
      }

      if (resolveResult === 'invalidAddress') {
        return {
          isValid: false,
          error: `Invalid TON domain format: ${receiver}. Please use a valid .ton domain.`,
        };
      }

      resolvedReceiverAddress = resolveResult.address;
    } catch (domainError) {
      return {
        isValid: false,
        // eslint-disable-next-line @stylistic/max-len
        error: `Failed to resolve TON domain ${receiver}: ${domainError instanceof Error ? domainError.message : 'Unknown error'}`,
      };
    }
  } else {
    try {
      Address.parse(receiver);
    } catch (addressError) {
      return {
        isValid: false,
        error: `Invalid receiver address format: ${receiver}. Please use a valid TON address or .ton domain.`,
      };
    }
  }

  // Validate amount
  if (!isValidAmount(amount)) {
    return {
      isValid: false,
      error: 'Invalid amount',
    };
  }

  // Validate and process token identifier
  try {
    const tokenValidationResult = await validateTokenIdentifier(tokenIdentifier);
    if (!tokenValidationResult.isValid) {
      return {
        isValid: false,
        error: tokenValidationResult.error || 'Invalid token identifier',
      };
    }

    const processedTransfer: TransferRow = {
      receiver,
      amount,
      tokenIdentifier,
      comment: comment ? trimStringByMaxBytes(comment, 5000) : undefined,
      resolvedTokenInfo: tokenValidationResult.tokenInfo,
      resolvedAddress: resolvedReceiverAddress !== receiver ? resolvedReceiverAddress : undefined,
    };

    return {
      isValid: true,
      processedTransfer,
    };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Invalid token identifier',
    };
  }
}
