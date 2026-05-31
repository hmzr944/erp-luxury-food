import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { ConfigService } from '@nestjs/config'

export interface PrintJob {
  printerId: number
  content: string   // ESC/POS base64 or raw text
  title?: string
}

@Injectable()
export class PrintingService {
  private readonly logger = new Logger(PrintingService.name)
  private readonly apiKey: string | undefined

  constructor(
    @InjectQueue('printing') private printQueue: Queue,
    private config: ConfigService,
  ) {
    this.apiKey = this.config.get('PRINTNODE_API_KEY')
    if (!this.apiKey) {
      this.logger.warn('PRINTNODE_API_KEY not set — printing disabled')
    }
  }

  // Enqueue a print job (fire & forget — never blocks checkout)
  async queue(job: PrintJob): Promise<void> {
    await this.printQueue.add('print', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    })
  }

  // Direct PrintNode API call (called by the processor)
  async printDirect(job: PrintJob): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('Print skipped: no API key configured')
      return
    }

    const response = await fetch('https://api.printnode.com/printjobs', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printerId: job.printerId,
        title: job.title ?? 'ERP Receipt',
        contentType: 'raw_base64',
        content: Buffer.from(job.content).toString('base64'),
        source: 'ERP',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`PrintNode error ${response.status}: ${error}`)
    }

    this.logger.log(`Printed on printer ${job.printerId}`)
  }
}
