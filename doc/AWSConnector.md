# reshuffle-aws-connectors

[Code](https://github.com/reshufflehq/reshuffle-aws-connectors) |
[npm](https://www.npmjs.com/package/reshuffle-aws-connectors) |
[Code sample](https://github.com/reshufflehq/reshuffle/blob/master/examples/aws/s3-list-files.js)

`npm install reshuffle-aws-connectors`

### Reshuffle AWS Connector

This [Reshuffle](https://github.com/reshufflehq/reshuffle) connector can be
used to access various AWS services.

The following example lists all S3 buckets using the AWS S3 SDK:

```js
const { Reshuffle } = require('reshuffle')
const { AWSConnector } = require('reshuffle-aws-connectors')

const app = new Reshuffle()

const awsConnector = new AWSConnector(app, {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

;(async () => {
  const s3 = awsConnector.sdk('S3')
  const res = await s3.listBuckets().promise()
  console.log(res.Buckets)

})().catch(console.error)
```

#### Table of Contents

[Configuration](#configuration) Configuration options

_SDK_:

[sdk](#sdk) Get direct SDK access

##### <a name="configuration"></a>Configuration options

```js
const app = new Reshuffle()
const awsConnector = new AWSConnector(app, {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})
```

#### SDK

##### <a name="sdk"></a>SDK action

_Definition:_

```ts
(
  serviceName: string,
  options ?: object,
) => object
```

_Usage:_

```js
const s3 = awsConnector.sdk('S3')
```

Get an AWS SDK object for the specified service. You can specify additional
options to override or add to the fields in the connector's configuration.
