import { TransferService } from '../api/transfer';
import { P2PService } from '../api/p2p';

declare global {
  interface Window {
    transferService: TransferService;
    p2pService: P2PService;
  }
}