import { TransferService } from '../api/transfer';

declare global {
  interface Window {
    transferService: TransferService;
  }
}