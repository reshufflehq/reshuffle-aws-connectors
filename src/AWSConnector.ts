import { Options, Reshuffle } from './CoreConnector'
import { BaseAWSConnector } from './BaseAWSConnector'

export class AWSConnector extends BaseAWSConnector {
  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
  }

  // SDK ////////////////////////////////////////////////////////////

  public sdk(serviceName: string, options?: Record<string, any>): any {
    return this.account.getClient(serviceName, options)
  }
}
