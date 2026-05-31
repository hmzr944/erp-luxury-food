import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import { PrintingService, type PrintJob } from './printing.service'

@Processor('printing')
export class PrintingProcessor {
  private readonly logger = new Logger(PrintingProcessor.name)

  constructor(private printing: PrintingService) {}

  @Process('print')
  async handlePrint(job: Job<PrintJob>) {
    try {
      await this.printing.printDirect(job.data)
    } catch (err) {
      this.logger.error(`Print job ${job.id} failed: ${err}`)
      throw err // Bull retries on throw
    }
  }
}
