# reshuffle-aws-connectors

[Code](https://github.com/reshufflehq/reshuffle-aws-connectors) |
[npm](https://www.npmjs.com/package/reshuffle-aws-connectors) |
[Code sample](https://github.com/reshufflehq/reshuffle/blob/master/examples/aws/lambda-create-invoke.js)

`npm install reshuffle-aws-connectors`

### Reshuffle AWS Lambda Connector

This [Reshuffle](https://github.com/reshufflehq/reshuffle) connector can be used to access AWS Lambda. It is implemented
using Amazon's
[Lambda SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html).

The following example creates, invokes and deletes a simple Lambda function:

```js
const crypto = require('crypto')
const { Reshuffle } = require('reshuffle')
const { AWSLambdaConnector } = require('reshuffle-aws-connectors')

;(async () => {
  const app = new Reshuffle()

  const awsLambdaConnector = new AWSLambdaConnector(app, {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_DEFAULT_REGION,
  })

  const funcName = `function-${crypto.randomBytes(8).toString('hex')}`

  console.log('Creating Lambda function:', funcName)
  await awsLambdaConnector.createFromCode(funcName, `
    exports.handler = async (event) => ({
      statusCode: 200,
      body: JSON.stringify(event),
    })
  `)

  const req = { foo: 'bar' }
  const res = await awsLambdaConnector.invoke(funcName, req)
  console.log('Lambda response:', req, '->', res)

  console.log('Deleting Lambda function')
  await awsLambdaConnector.delete(funcName)
})()
```

#### Table of Contents

[Configuration](#configuration) Configuration options

_Connector events_:

[queueComplete](#queueComplete) Queue processing is complete

_Connector actions_:

[command](#command) Run a CLI command on Lambda

[create](#create) Create a new Lambda function

[createFromBuffer](#createFromBuffer) Create a new Lambda function from buffer

[createFromCode](#createFromCode) Create a new Lambda function from code string

[createFromFile](#createFromFile) Create a new Lambda function from file

[createInFolder](#createInFolder) Create a new Lambda function by collecting files in a folder

[delete](#delete) Delete a Lambda function

[enqueue](#enqueue) Process a queue of tasks in Lambda functions

[getFunctionInfo](#getFunctionInfo) Get detailed function information

[invoke](#invoke) Execute a Lambda function

[listFunctions](#listFunctions) List deployed functions

[updateCode](#updateCode) Update Lambda function code

[updateCodeFromBuffer](#updateCodeFromBuffer) Update Lambda function code from buffer

[updateCodeFromCode](#updateCodeFromCode) Update Lambda function code from code string

[updateCodeFromFile](#updateCodeFromFile) Update Lambda function code from file

[updateCodeInFolder](#updateCodeInFolder) Update Lambda function code by collecting files in a folder

_SDK_:

[sdk](#sdk) Get direct SDK access

##### <a name="configuration"></a>Configuration options

```js
const app = new Reshuffle()
const awsLambdaConnector = new AWSLambdaConnector(app, {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION,
})
```

#### Connector events

##### <a name="queueComplete"></a>Queue Complete event

_Example:_

```js
awsLambdaConnector.on(
  { type: 'QueueComplete' },
  async (event, app) => {
    console.log(event.qid)
    console.log(event.payloads)
    console.log(event.resolutions)
  }
)
```

This event is fired when a processing queue has completed processing all
its payloads. See the [enqueue](#enqueue) action for details.

#### Connector actions

##### <a name="command"></a>Command action

```ts
(
  functionName: string,
  executable: string,
  command: string,
  files: string | string[] = [],
  options: Options = {},
) => any
```

_Usage:_

```js
const mediaInfo = await awsLambdaConnector.command(
  'reshuffle-command-mediainfo',
  'https://<my-server>/mediainfo'
  `mediainfo --output=JSON <my-video>`,
  's3://<my-bucket>/<my-video>',
)
```

Use AWS Lambda to run a CLI command. This action invokes the Lambda function named `functionName`, loads the files with the specified `urls` into a
temporary folder and runs the specified CLI `command`. The standard output
from the CLI command is collected and returned to the user. At this point,
the action does not support collection of output files generated by the CLI
command.

URLs for executable and files can be either HTTP(S) URLS or S3 URLS. Note
that the executable name in `command` must match the filename in the
specified by the `executable` URL.

If needed, the action creates the Labda function and loads `executable`
into the Lambda container. The executable needs to be compatible with
the AWS Lambda Linux runtime environment. If a Lambda function with this
name exists that was not previsouly deployed by the connector, deployment
fails. If a Lambda exists that was deployed by the connector, then
deployment is skipped unless `options.force` is `true`.

The `options` are the same as the ones used by [create](#create) with the
addition of the `force` flag mentioned above.

##### <a name="create"></a>Create action

_Definition:_

```ts
interface Payload {
  code?: string
  filename?: string
  buffer?: Buffer
}

(
  functionName: string,
  payload: Payload,
  options: object = {},
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.create(
  'toLowerUpperString',
  { code: `
    exports.handler = async (event) => {
      const str = event.str || 'Hello, world!'
      return {
        statusCode: 200,
        body: JSON.stringify({
          lower: str.toLowerCase(),
          upper: str.toUpperCase(),
        }),
      }
    }
  ` },
)
```

Create a new Lambda function with the given `functionName`. The code for
the newly created function can be specified in one of three ways:

* `buffer` a NodeJS buffer with zipped content (a package like [JSZip](https://stuk.github.io/jszip/) can help)
* `code` a string with code
* `filename` a name of a file containing code

The optional `options` object may contain the following properties:

* `env` - Environment variables
* `memorySize` - Container memory size in MB (defaults to 256)
* `roleName` - Function execution role (defaults to `lambda_basic_execution`)
* `runtime` - Runtime environment (defaults to `nodejs12.x`)
* `tags` - Tags
* `timeout` - Execution timeout in seconds (default to 3)

The created function can be invoked using the [invoke](#invoke) action, or
tied to a myriad of AWS supported events.

We note that the AWS SDK provides many more options for creating and
configuring Lambda functions. For example, functions can be deployed
from an S3 zip file, allowing multiple files and dependencies to be
deployed simultaneously. to leverage these capbilities, you can use
the [sdk](#sdk) action to gain direct access to the SDK and use its
[createFunction](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#createFunction-property)
method directly.

##### <a name="createFromBuffer"></a>Create From Buffer action

_Definition:_

```ts
(
  functionName: string,
  buffer: Buffer,
  options: object = {},
) => object
```

_Usage:_

```js
const zip = new require('JSZip')()
// ... add files ...
const buffer = await zip.generateAsync({ type: 'nodebuffer' })
const functionInfo = await awsLambdaConnector.createFromBuffer(
  'toLowerUpperString',
  buffer,
)
```

Create a new Lambda function with the given `functionName` to execute
the code in the specified buffer. See [create](#create) above for more
details.

##### <a name="createFromCode"></a>Create From Code action

_Definition:_

```ts
(
  functionName: string,
  code: string,
  options: object = {},
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.createFromCode(
  'toLowerUpperString',
  `
  exports.handler = async (event) => {
    const str = event.str || 'Hello, world!'
    return {
      statusCode: 200,
      body: JSON.stringify({
        lower: str.toLowerCase(),
        upper: str.toUpperCase(),
      }),
    }
  }
  `,
)
```

Create a new Lambda function with the given `functionName` to execute
the code in `code`. See [create](#create) above for more details.

##### <a name="createFromFile"></a>Create From File action

_Definition:_

```ts
(
  functionName: string,
  filename: string,
  options: object = {},
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.createFromFile(
  'toLowerUpperString',
  './toLowerUpperString.js',
)
```

Create a new Lambda function with the given `functionName` to execute
the code inside the file `filename`. See [create](#create) above for more
details.

##### <a name="createInFolder"></a>Create In Folder action

_Definition:_

```ts
(
  functionName: string,
  fileHandler: async (folder => Folder) => Promise<void>,
  options: object = {},
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.createInFolder(
  'toLowerUpperString',
  async folder => {
    await folder.copy('index.js', `${__dirname}/toLowerUpperString.js`)
  }
)
```

Create a new Lambda function with the given `functionName` by setting up
files in a folder. The `folderHandler` object receives a single `folder`
object that provides the following methods:

* **copy(targetName: string, sourcePath: string): Promise<void>** Copy a file into the folder
* **exec(cmd: string): Promise<{ error?: Error, stdout: string | Buffer, stderr: string | Buffer }>** Run a command inside the folder
* **contains(filename: string): Promise<boolean>** Check if the folder contains a file
* **write(targetName: string, data: string): Promise<void>** Create a file inside the folder with the specified data

See [create](#create) above for more details.

##### <a name="delete"></a>Delete action

_Definition:_

```ts
(
  functionName: string,
) => void
```

_Usage:_

```js
await awsLambdaConnector.delete('toLowerUpperString')
```

Delete the Lambda function with the name `functionName`. Be careful, this
action is not reversible and will delete any function, not just ones
created by this connector.

##### <a name="enqueue"></a>Enqueue action

_Definition:_

```ts
(
  functionName: string,
  payload: any|any[],
  maxConcurrent: number = 100,
) => string
```

_Usage:_

```js
const qid = await awsLambdaConnector.enqueue(
  'toLowerUpperString',
  [
    { str: 'Alpha' },
    { str: 'Beta' },
    { str: 'Gamma' },
  ],
)
```

Asynchronously process a series of tasks with the Lambda function named
`functionName`. The `payload` is an array of elements, each would be passed
in turn as an input to the Lambda function. If `payload` is scalar, only
a single invocation will ensue.

The `maxConcurrent` argument can be used to limit the number of simultaneous
invocaions of the Lambda function, with a hard limit of 100 per queue.
Currently the connector does not enforce a global limit on the number
of functions it invokes through this action.

When all payloads have been processed, the action triggers a
[queueComplete](#queueComplete) event with the queue ID, the payloads array
and a resolutions array in the event object. Each resolution is either the
value returned by the Lambda function or an `Error` object if the invocation
failed.

##### <a name="getFunctionInfo"></a>Get Function Info action

_Definition:_

```ts
(
  functionName: string,
) => any
```

_Usage:_

```js
const info = await awsLambdaConnector.getFunctionInfo(
  'toLowerUpperString',
)
```

Get detailed information about the specified function.

##### <a name="invoke"></a>Invoke action

_Definition:_

```ts
(
  functionName: string,
  requestPayload: any = {},
) => any
```

_Usage:_

```js
const { lower, upper } = await awsLambdaConnector.invoke(
  'toLowerUpperString',
  { str: 'My Awesome String' },
)
```

Invoke the Lambda function with the name `functionName`, passing it the
payload provided in `requestPayload`. The payload can be any JSON
serializable JavaScript object.

The invoke action returns the response payload returned by the Lambda
function. In case of an error during invocation or execution of the
function, this action throws an error.

##### <a name="listFunctions"></a>List Functions action

_Definition:_

```ts
() => any[]
```

_Usage:_

```js
const list = await awsLambdaConnector.listFunctions()
```

Get information about deployed Lambda functions.

##### <a name="updateCode"></a>Update Code action

_Definition:_

```ts
(
  functionName: string,
  payload: Payload,
  options: object = {},
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.updateCode(
  'toLowerUpperString',
  { code: `
    exports.handler = async (event) => {
      const str = event.str || 'Hello, beautiful world!!'
      return {
        statusCode: 200,
        body: JSON.stringify({
          lower: str.toLowerCase(),
          upper: str.toUpperCase(),
        }),
      }
    }
  ` },
)
```

Update the code of an existing Lambda function with the given `functionName`.
The code can be specified in one of three ways, as defined in [create](#create)
above.

##### <a name="updateCodeFromBuffer"></a>Update Code From Buffer action

_Definition:_

```ts
(
  functionName: string,
  buffer: Buffer,
) => object
```

_Usage:_

```js
const zip = new require('JSZip')()
// ... add files ...
const buffer = await zip.generateAsync({ type: 'nodebuffer' })
const functionInfo = await awsLambdaConnector.updateCodeFromBuffer(
  'toLowerUpperString',
  buffer,
)
```

Update an existing Lambda function with the given `functionName` to execute
the code in the specified buffer. See [create](#create) above for more
details.

##### <a name="updateCodeFromCode"></a>Update Code From Code action

_Definition:_

```ts
(
  functionName: string,
  code: string,
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.updateCodeFromCode(
  'toLowerUpperString',
  `
  exports.handler = async (event) => {
    const str = event.str || 'Hello, beautiful world!!'
    return {
      statusCode: 200,
      body: JSON.stringify({
        lower: str.toLowerCase(),
        upper: str.toUpperCase(),
      }),
    }
  }
  `,
)
```

Update an existing Lambda function with the given `functionName` to execute
the code in `code`. See [create](#create) above for more details.

##### <a name="updateCodeFromFile"></a>Update Code From File action

_Definition:_

```ts
(
  functionName: string,
  filename: string,
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.createFromFile(
  'toLowerUpperString',
  './toLowerUpperString.js',
)
```

Update an existing Lambda function with the given `functionName` to execute
the code inside the file `filename`. See [create](#create) above for more
details.

##### <a name="updateCodeInFolder"></a>Update Code In Folder action

_Definition:_

```ts
(
  functionName: string,
  fileHandler: async (folder => Folder) => Promise<void>,
) => object
```

_Usage:_

```js
const functionInfo = await awsLambdaConnector.updateCodeInFolder(
  'toLowerUpperString',
  async folder => {
    await folder.copy('index.js', `${__dirname}/toLowerUpperString.js`)
  }
)
```

Update an existing Lambda function with the given `functionName` to execute
the code set up in a folder. See [createInFolder](#createInFolder) above for
more details.


#### SDK

##### <a name="sdk"></a>SDK action

_Definition:_

```ts
(
  options ?: object,
) => object
```

_Usage:_

```js
const lambda = await awsLambdaConnector.sdk()
```

Get the underlying SDK object. You can specify additional options to override
or add to the required fields in the connector's configuration.
