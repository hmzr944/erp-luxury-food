import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import { StockService, type StockDecrementPayload } from './stock.service'

@Processor('stock')
export class StockProcessor {
  private readonly logger = new Logger(StockProcessor.name)

  constructor(private stock: StockService) {}

  @Process('decrement')
  async handleDecrement(job: Job<StockDecrementPayload>) {
    try {
      await this.stock.decrementItems(job.data)
    } catch (err) {
      this.logger.error(`Stock decrement job ${job.id} failed: ${err}`)
      throw err
    }
  }
}
