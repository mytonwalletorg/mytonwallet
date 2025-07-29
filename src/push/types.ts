export interface ApiCheck {
  id: number;
  contractAddress: string;
  status: 'pending_signature' | 'sending' | 'pending_receive' | 'receiving' | 'received' | 'failed';
  isInvoice?: boolean;
  isCurrentUserSender?: boolean;
  amount: number;
  symbol: 'TON' | 'USDT' | 'MY';
  minterAddress: string;
  decimals: number;
  chatInstance?: string;
  username?: string;
  comment?: string;
  txId?: string;
  receiverAddress?: string;
  failureReason?: string;
}
