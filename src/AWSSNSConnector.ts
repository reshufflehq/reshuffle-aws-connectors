import { Options, Reshuffle } from './CoreConnector'
import { AWS, BaseAWSConnector } from './BaseAWSConnector'

export class AWSSNSConnector extends BaseAWSConnector {
  private readonly client: AWS.SNS

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    this.client = this.account.getClient('SNS')
  }

  public async publish(params: AWS.SNS.Types.PublishInput) {
    return this.client.publish(params).promise()
  }

  public sdk() {
    return this.client
  }
}
