# reshuffle-aws-connectors

[Code](https://github.com/reshufflehq/reshuffle-aws-connectors) |
[npm](https://www.npmjs.com/package/reshuffle-aws-connectors) |
[Code sample](https://github.com/reshufflehq/reshuffle-aws-connectors/examples)

`npm install reshuffle-aws-connectors`

### Reshuffle AWS SQS Connector

This [Reshuffle](https://dev.reshuffle.com) connector can be used to interact with AWS SQS queues.
[AWS SQS documentation](https://docs.aws.amazon.com/sqs/index.html).

The following code listens to new messages in the queue. When a message arrives it logs the details of the message event.
```js
const { HttpConnector, Reshuffle } = require('reshuffle')
const { AWSSQSConnector } = require('reshuffle-aws-connectors')

const queueUrl = 'https://sqs.<region>.amazonaws.com/<id>/<queue_name>'

const app = new Reshuffle()

const sqsConnector = new AWSSQSConnector(app, {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

sqsConnector.on({ queueUrl }, (event, app) => {
  console.log('new message', event)
  //{ MessageId: '71c06956-76e1-4a8c-bc00-ed910566f36e', ReceiptHandle: 'AQEBTL1CTtn1clJ0XMSmRtpz7...', MD5OfBody: '9a72c70562843b823c2c9cad30665fe4', Body: 'Message from Reshuffle to queue' }
})

app.start()
```

#### Table of Contents

[Configuration](#configuration) Configuration options

_Connector events_:

[Receive messages event](#receiveMessagesEvent) Receive messages event

_Connector actions_:

[Send message](#sendMessage) Send a message
_SDK_:

[sdk](#sdk) Get direct SQS SDK access

##### <a name="configuration"></a>Configuration options

```js
const app = new Reshuffle()
const awsSQSConnector = new AWSSQSConnector(app, {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION,
})
```

#### Connector events

##### <a name="receiveMessagesEvent"></a>Receive messages event
_Event parameters:_

```typescript
interface AWSSQSConnectorEventOptions {
queueUrl: string // SQS queue url
deleteAfterReceive?: boolean // default to true
}
```

_Handler inputs:_

```typescript
(event: MESSAGE, app: Reshuffle) => void

interface MESSAGE {
  MessageId?: string
  ReceiptHandle?: string
  MD5OfBody?: string
  Body?: string
  Attributes?: MessageSystemAttributeMap
  MD5OfMessageAttributes?: string
  MessageAttributes?: MessageBodyAttributeMap
}
```

_Example:_

```js
(event, app) => { 
  console.log('new message received', event)
  // 'new message received', { MessageId: '71c06956-76e1-4a8c-bc00-ed910566f36e', ReceiptHandle: 
  // 'AQEBTL1CTtn1clJ0XMSmRtpz7...', MD5OfBody: '9a72c70562843b823c2c9cad30665fe4', Body: 'Message 
  // from Reshuffle to queue' }
}
```

This event is triggered when new messages are received from the queue.
Reshuffle checks for new messages every minute.
Per default, it deletes the messages from the queue once retrieved. 
Set `deleteAfterReceive` to `false` to prevent this.

__Note:__ if you do so, events can be triggered several times for the same message depending on your queue strategy.

#### Connector actions

Most of the actions are provided via the [sdk](#sdk).

##### <a name="sendMessage"></a>Send message

_Definition:_

```ts
(params: AWS.SQS.Types.SendMessageRequest) => Promise<PromiseResult<AWS.SQS.SendMessageResponse, AWS.AWSError>>

export interface SendMessageRequest {
  QueueUrl: string
  MessageBody: string
  DelaySeconds?: Integer
  MessageAttributes?: MessageBodyAttributeMap
  MessageSystemAttributes?: MessageBodySystemAttributeMap
  MessageDeduplicationId?: string
  MessageGroupId?: string
}
export interface SendMessageResult {
  MD5OfMessageBody?: string
  MD5OfMessageAttributes?: string
  MD5OfMessageSystemAttributes?: string
  MessageId?: string
  SequenceNumber?: string
}
```

Go [here](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html) for sendMessage AWS documentation.

_Usage:_

```js
const params = {
  MessageBody: 'Message from Reshuffle to AWS SQS!',
  QueueUrl: 'https://sqs.us-east-1.amazonaws.com/<project_id>/<queue_name>',
}
const response = await sqsConnector.sendMessage(params)
console.log(response.MessageId)
```

#### SDK

##### <a name="sdk"></a>SDK action

Returns an AWS SQS client instance
Full list of available actions in [NODE AWS SQS client](https://github.com/aws/aws-sdk-js/blob/master/clients/sqs.d.ts)

_Definition:_

```ts
() => AWS.SQS
```

_Usage:_

```js
const sqs = await sqsConnector.sdk()
```

_Example:_

Receive messages from queue
```js
const response = await sqsConnector.sdk().receiveMessage({ QueueUrl }).promise()
console.log(response.Messages)
```

For more examples, go [here](https://github.com/reshufflehq/reshuffle/tree/master/examples/aws/sqs-messages.js).
