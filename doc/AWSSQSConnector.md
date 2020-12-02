# reshuffle-aws-connectors

[Code](https://github.com/reshufflehq/reshuffle-aws-connectors) |
[npm](https://www.npmjs.com/package/reshuffle-aws-connectors) |
[Code sample](https://github.com/reshufflehq/reshuffle-aws-connectors/examples)

`npm install reshuffle-aws-connectors`

### Reshuffle AWS SQS Connector

This [Reshuffle](https://dev.reshuffle.com) connector can be used to interact with queues.
[AWS SQS documentation](https://docs.aws.amazon.com/sqs/index.html).

// The following example listen to new messages in the queue if a message is not already present in an AWS queue, if not send it.
// Triggered when Reshuffle receives an HTTP request on /send
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

[Send message](#sendMessage) Send messages
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
  /**
   * A unique identifier for the message. A MessageIdis considered unique across all AWS accounts for an extended period of time.
   */
  MessageId?: string
  /**
   * An identifier associated with the act of receiving the message. A new receipt handle is returned every time you receive a message. When deleting a message, you provide the last received receipt handle to delete the message.
   */
  ReceiptHandle?: string
  /**
   * An MD5 digest of the non-URL-encoded message body string.
   */
  MD5OfBody?: string
  /**
   * The message's contents (not URL-encoded).
   */
  Body?: string
  /**
   * A map of the attributes requested in  ReceiveMessage  to their respective values. Supported attributes:    ApproximateReceiveCount     ApproximateFirstReceiveTimestamp     MessageDeduplicationId     MessageGroupId     SenderId     SentTimestamp     SequenceNumber     ApproximateFirstReceiveTimestamp and SentTimestamp are each returned as an integer representing the epoch time in milliseconds.
   */
  Attributes?: MessageSystemAttributeMap
  /**
   * An MD5 digest of the non-URL-encoded message attribute string. You can use this attribute to verify that Amazon SQS received the message correctly. Amazon SQS URL-decodes the message before creating the MD5 digest. For information about MD5, see RFC1321.
   */
  MD5OfMessageAttributes?: string
  /**
   * Each message attribute consists of a Name, Type, and Value. For more information, see Amazon SQS Message Attributes in the Amazon Simple Queue Service Developer Guide.
   */
  MessageAttributes?: MessageBodyAttributeMap
}
```

_Example:_

```js
(event, app) => { 
  console.log('new message received', event)
  // 'new message received', { MessageId: '71c06956-76e1-4a8c-bc00-ed910566f36e', ReceiptHandle: 'AQEBTL1CTtn1clJ0XMSmRtpz7...', MD5OfBody: '9a72c70562843b823c2c9cad30665fe4', Body: 'Message from Reshuffle to queue' }
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
  /**
   * The URL of the Amazon SQS queue to which a message is sent. Queue URLs and names are case-sensitive.
   */
  QueueUrl: string
  /**
   * The message to send. The minimum size is one character. The maximum size is 256 KB.  A message can include only XML, JSON, and unformatted text. The following Unicode characters are allowed:  #x9 | #xA | #xD | #x20 to #xD7FF | #xE000 to #xFFFD | #x10000 to #x10FFFF  Any characters not included in this list will be rejected. For more information, see the W3C specification for characters.
   */
  MessageBody: string
  /**
   *  The length of time, in seconds, for which to delay a specific message. Valid values: 0 to 900. Maximum: 15 minutes. Messages with a positive DelaySeconds value become available for processing after the delay period is finished. If you don't specify a value, the default value for the queue applies.   When you set FifoQueue, you can't set DelaySeconds per message. You can set this parameter only on a queue level.
   */
  DelaySeconds?: Integer
  /**
   * Each message attribute consists of a Name, Type, and Value. For more information, see Amazon SQS Message Attributes in the Amazon Simple Queue Service Developer Guide.
   */
  MessageAttributes?: MessageBodyAttributeMap
  /**
   * The message system attribute to send. Each message system attribute consists of a Name, Type, and Value.    Currently, the only supported message system attribute is AWSTraceHeader. Its type must be String and its value must be a correctly formatted AWS X-Ray trace header string.   The size of a message system attribute doesn't count towards the total size of a message.
   */
  MessageSystemAttributes?: MessageBodySystemAttributeMap
  /**
   * This parameter applies only to FIFO (first-in-first-out) queues. The token used for deduplication of sent messages. If a message with a particular MessageDeduplicationId is sent successfully, any messages sent with the same MessageDeduplicationId are accepted successfully but aren't delivered during the 5-minute deduplication interval. For more information, see  Exactly-Once Processing in the Amazon Simple Queue Service Developer Guide.   Every message must have a unique MessageDeduplicationId,   You may provide a MessageDeduplicationId explicitly.   If you aren't able to provide a MessageDeduplicationId and you enable ContentBasedDeduplication for your queue, Amazon SQS uses a SHA-256 hash to generate the MessageDeduplicationId using the body of the message (but not the attributes of the message).    If you don't provide a MessageDeduplicationId and the queue doesn't have ContentBasedDeduplication set, the action fails with an error.   If the queue has ContentBasedDeduplication set, your MessageDeduplicationId overrides the generated one.     When ContentBasedDeduplication is in effect, messages with identical content sent within the deduplication interval are treated as duplicates and only one copy of the message is delivered.   If you send one message with ContentBasedDeduplication enabled and then another message with a MessageDeduplicationId that is the same as the one generated for the first MessageDeduplicationId, the two messages are treated as duplicates and only one copy of the message is delivered.     The MessageDeduplicationId is available to the consumer of the message (this can be useful for troubleshooting delivery issues). If a message is sent successfully but the acknowledgement is lost and the message is resent with the same MessageDeduplicationId after the deduplication interval, Amazon SQS can't detect duplicate messages. Amazon SQS continues to keep track of the message deduplication ID even after the message is received and deleted.  The maximum length of MessageDeduplicationId is 128 characters. MessageDeduplicationId can contain alphanumeric characters (a-z, A-Z, 0-9) and punctuation (!"#$%&amp;'()*+,-./:;&lt;=&gt;?@[\]^_`{|}~). For best practices of using MessageDeduplicationId, see Using the MessageDeduplicationId Property in the Amazon Simple Queue Service Developer Guide.
   */
  MessageDeduplicationId?: string
  /**
   * This parameter applies only to FIFO (first-in-first-out) queues. The tag that specifies that a message belongs to a specific message group. Messages that belong to the same message group are processed in a FIFO manner (however, messages in different message groups might be processed out of order). To interleave multiple ordered streams within a single queue, use MessageGroupId values (for example, session data for multiple users). In this scenario, multiple consumers can process the queue, but the session data of each user is processed in a FIFO fashion.   You must associate a non-empty MessageGroupId with a message. If you don't provide a MessageGroupId, the action fails.    ReceiveMessage might return messages with multiple MessageGroupId values. For each MessageGroupId, the messages are sorted by time sent. The caller can't specify a MessageGroupId.   The length of MessageGroupId is 128 characters. Valid values: alphanumeric characters and punctuation (!"#$%&amp;'()*+,-./:;&lt;=&gt;?@[\]^_`{|}~). For best practices of using MessageGroupId, see Using the MessageGroupId Property in the Amazon Simple Queue Service Developer Guide.   MessageGroupId is required for FIFO queues. You can't use it for Standard queues.
   */
  MessageGroupId?: string
}
export interface SendMessageResult {
  /**
   * An MD5 digest of the non-URL-encoded message attribute string. You can use this attribute to verify that Amazon SQS received the message correctly. Amazon SQS URL-decodes the message before creating the MD5 digest. For information about MD5, see RFC1321.
   */
  MD5OfMessageBody?: string
  /**
   * An MD5 digest of the non-URL-encoded message attribute string. You can use this attribute to verify that Amazon SQS received the message correctly. Amazon SQS URL-decodes the message before creating the MD5 digest. For information about MD5, see RFC1321.
   */
  MD5OfMessageAttributes?: string
  /**
   * An MD5 digest of the non-URL-encoded message system attribute string. You can use this attribute to verify that Amazon SQS received the message correctly. Amazon SQS URL-decodes the message before creating the MD5 digest.
   */
  MD5OfMessageSystemAttributes?: string
  /**
   * An attribute containing the MessageId of the message sent to the queue. For more information, see Queue and Message Identifiers in the Amazon Simple Queue Service Developer Guide.
   */
  MessageId?: string
  /**
   * This parameter applies only to FIFO (first-in-first-out) queues. The large, non-consecutive number that Amazon SQS assigns to each message. The length of SequenceNumber is 128 bits. SequenceNumber continues to increase for a particular MessageGroupId.
   */
  SequenceNumber?: string
}
```

_Usage:_

```js
const params = {
  MessageBody: 'Message from Reshuffleto AQS SQS!',
  QueueUrl: 'https://sqs.us-east-1.amazonaws.com/<project_id>/<queue_name>',
}
const response = await sqsConnector.sendMessage(params)
console.log(response.MessageId)
```

#### SDK

##### <a name="sdk"></a>SDK action

Returns a AWS SQS client instance
// Full list of available actions in SDK: https://github.com/aws/aws-sdk-js/blob/master/clients/sqs.d.ts

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

For more examples, go to [here](https://github.com/reshufflehq/reshuffle/tree/master/examples/aws/sqs-messages.js).