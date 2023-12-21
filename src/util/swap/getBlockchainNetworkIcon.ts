import avalancheBlockchainIcon from '../../assets/blockchain/chain_avalanche.png';
import bitcoinBlockchainIcon from '../../assets/blockchain/chain_bitcoin.png';
import bitcoincashBlockchainIcon from '../../assets/blockchain/chain_bitcoincash.png';
import bnbBlockchainIcon from '../../assets/blockchain/chain_bnb.png';
import cardanoBlockchainIcon from '../../assets/blockchain/chain_cardano.png';
import cosmosBlockchainIcon from '../../assets/blockchain/chain_cosmos.png';
import dashBlockchainIcon from '../../assets/blockchain/chain_dash.png';
import dogeBlockchainIcon from '../../assets/blockchain/chain_doge.png';
import eosBlockchainIcon from '../../assets/blockchain/chain_eos.png';
import ethereumBlockchainIcon from '../../assets/blockchain/chain_ethereum.png';
import ethereumclassicBlockchainIcon from '../../assets/blockchain/chain_ethereumclassic.png';
import internetcomputerBlockchainIcon from '../../assets/blockchain/chain_internetcomputer.png';
import iotaBlockchainIcon from '../../assets/blockchain/chain_iota.png';
import litecoinBlockchainIcon from '../../assets/blockchain/chain_litecoin.png';
import moneroBlockchainIcon from '../../assets/blockchain/chain_monero.png';
import polkadotBlockchainIcon from '../../assets/blockchain/chain_polkadot.png';
import rippleBlockchainIcon from '../../assets/blockchain/chain_ripple.png';
import solanaBlockchainIcon from '../../assets/blockchain/chain_solana.png';
import stellarBlockchainIcon from '../../assets/blockchain/chain_stellar.png';
import tonBlockchainIcon from '../../assets/blockchain/chain_ton.png';
import tronBlockchainIcon from '../../assets/blockchain/chain_tron.png';
import zcashBlockchainIcon from '../../assets/blockchain/chain_zcash.png';

const BLOCKCHAIN_ICON_MAP: Record<string, string> = {
  avalanche: avalancheBlockchainIcon,
  bitcoin: bitcoinBlockchainIcon,
  bitcoin_cash: bitcoincashBlockchainIcon,
  binance_smart_chain: bnbBlockchainIcon,
  binance_dex: bnbBlockchainIcon,
  cardano: cardanoBlockchainIcon,
  cosmos: cosmosBlockchainIcon,
  dash: dashBlockchainIcon,
  doge: dogeBlockchainIcon,
  eos: eosBlockchainIcon,
  ethereum: ethereumBlockchainIcon,
  ethereum_classic: ethereumclassicBlockchainIcon,
  internet_computer: internetcomputerBlockchainIcon,
  iota: iotaBlockchainIcon,
  litecoin: litecoinBlockchainIcon,
  monero: moneroBlockchainIcon,
  polkadot: polkadotBlockchainIcon,
  ripple: rippleBlockchainIcon,
  solana: solanaBlockchainIcon,
  stellar: stellarBlockchainIcon,
  ton: tonBlockchainIcon,
  tron: tronBlockchainIcon,
  zcash: zcashBlockchainIcon,
};
export default function getBlockchainNetworkIcon(networkName?: string) {
  if (!networkName) return '';

  return BLOCKCHAIN_ICON_MAP[networkName] ?? networkName;
}
