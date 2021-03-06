import { CoreEventHandler, Options, Reshuffle } from './CoreConnector'
import { AWS, BaseAWSConnector } from './BaseAWSConnector'
import { PromiseResult } from 'aws-sdk/lib/request'
import EventConfiguration from 'reshuffle-base-connector/dist/EventConfiguration'
import { DeleteMessageBatchRequestEntry } from 'aws-sdk/clients/sqs'

export interface AWSSQSConnectorEventOptions {
  queueUrl: string
  deleteAfterReceive?: boolean
}

export class AWSSQSConnector extends BaseAWSConnector {
  private readonly client: AWS.SQS

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    this.client = this.account.getClient('SQS')
  }

  on(
    options: AWSSQSConnectorEventOptions,
    handler: CoreEventHandler,
    eventId?: string,
  ): EventConfiguration {
    const eid = eventId || `AWS/SQS/message/${options.queueUrl}/${this.id}`
    return this.eventManager.addEvent(options, handler, eid)
  }

  protected async onInterval(): Promise<void> {
    const events = Object.values(this.eventManager.eventConfigurationSet)
    const queueUrls = events.reduce<Record<string, AWSSQSConnectorEventOptions>>(
      (acc, ev) => ({ ...acc, [ev.options.queueUrl]: ev.options }),
      {},
    )

    for (const { queueUrl, deleteAfterReceive } of Object.values(queueUrls)) {
      const queueMessages = await this.getQueueMessages(queueUrl, deleteAfterReceive)

      if (queueMessages.length) {
        await this.eventManager.fire((ec) => ec.options.queueUrl === queueUrl, queueMessages)
      }
    }
  }

  private async getQueueMessages(queueUrl: string, deleteAfterReceive = true) {
    const res = await this.client.receiveMessage({ QueueUrl: queueUrl }).promise()
    if (res.Messages && res.Messages.length) {
      this.app
        .getLogger()
        .info(
          `ReshuffleAWSSQSConnector: ${res.Messages.length} ` +
            `message(s) received from queue ${queueUrl}`,
        )

      if (deleteAfterReceive) {
        const Entries = res.Messages.map<DeleteMessageBatchRequestEntry>((msg) => ({
          Id: msg.MessageId || '',
          ReceiptHandle: msg.ReceiptHandle || '',
        }))

        await this.client.deleteMessageBatch({ QueueUrl: queueUrl, Entries }).promise()
        this.app
          .getLogger()
          .info(
            'ReshuffleAWSSQSConnector: received messages have been ' +
              `deleted from queue ${queueUrl}`,
          )
      }
    } else {
      this.app.getLogger().debug(`ReshuffleAWSSQSConnector:  no new message from queue ${queueUrl}`)
    }

    return res.Messages || []
  }

  public async sendMessage(
    params: AWS.SQS.Types.SendMessageRequest,
  ): Promise<PromiseResult<AWS.SQS.SendMessageResult, AWS.AWSError>> {
    return this.client.sendMessage(params).promise()
  }

  // Full list of actions in SDK:
  // https://github.com/aws/aws-sdk-js/blob/master/clients/sqs.d.ts
  public sdk(): AWS.SQS {
    return this.client
  }
}
