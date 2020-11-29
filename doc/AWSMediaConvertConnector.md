# reshuffle-aws-connectors

[Code](https://github.com/reshufflehq/reshuffle-aws-connectors) |
[npm](https://www.npmjs.com/package/reshuffle-aws-connectors) |
[Code sample](https://github.com/reshufflehq/reshuffle-aws-connectors/examples)

`npm install reshuffle-aws-connectors`

### Reshuffle AWS Media Convert Connector

This [Reshuffle](https://dev.reshuffle.com) connector can be used to transcode video and audio using Amazon's
Elemental Media Convert service. Complete information about the service API
can be found [Elemental Media Convert](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html).

The following example provides two API endpoints, one to initiate a
transcoding job and another for tracking its progress:

```js
const { HttpConnector, Reshuffle } = require('reshuffle')
const { AWSMediaConvertConnector } = require('reshuffle-aws-connectors')

;(async () => {
  const bucket = process.env.AWS_DEFAULT_BUCKET

  const app = new Reshuffle()
  const awsMediaConvertConnector = new AWSMediaConvertConnector(app, {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_DEFAULT_REGION,
  })
  const httpConnector = new HttpConnector(app)

  httpConnector.on({ method: 'GET', path:'/go' }, async (event) => {
    const filename = event.req.query.filename
    if (!filename) {
      return event.res.status(400).json({ error: 'No filename' })
    }

    const job = await awsMediaConvertConnector.createSingleJob(
      `s3://${bucket}/${filename}`,
      `s3://${bucket}/${filename}-thumbnail`,
      {
        VideoDescription: {
          Height: 200,
          Width: 200,
          CodecSettings: {
            Codec: 'H_264',
            H264Settings: {
              Bitrate: 262144,
            },
          },
        },
        ContainerSettings: {
          Container: 'MP4',
        },
      },
    )

    return event.res.json({ jobId: job.Id })
  })

  awsMediaConvertConnector.on({ type: 'JobStatusChanged' }, async (event) => {
    console.log(`Job progress ${event.jobId}: ${
      event.old.Status} -> ${event.current.Status}`)
  })

  app.start(8000)
})()
```

#### Table of Contents

[Configuration](#configuration) Configuration options

_Connector events_:

[jobStatusChanged](#jobStatusChanged) Job status changed

_Connector actions_:

[cancelJob](#cancelJob) Cancel a transcoding job

[cancelJobById](#cancelJobById) Cancel a transcoding job using its Id

[createJob](#createJob) Create a new transcoding job

[createSimpleJob](#createSimpleJob) Create a simple transcoding job

[createSingleJob](#createSingleJob) Create a job for transcoding a single file

[getJobStatus](#getJobStatus) Get the status of a transcoding job

[getJobStatusById](#getJobStatusById) Get job status by its Id

[listJobs](#listJobs) List active and past transcoding jobs

[listJobsById](#listJobsById) List jobs and index by job Id

_SDK_:

[sdk](#sdk) Get direct SDK access

##### <a name="configuration"></a>Configuration options

```js
const app = new Reshuffle()
const awsMediaConvertConnector = new AWSMediaConvertConnector(app, {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION,
})
```

#### Connector events

##### <a name="jobStatusChanged"></a>Job Status Changed event

_Example:_

```js
async (job) => {
  console.log(`Media Convert job ${job.jobId}: ${job.current.Status}`);
}
```

This event is fired when the status of a transcoding job changes. The
event object contains the followin information:

```ts
{
  jobId: string,
  current: {
    Id: string,
    Status: string,
  },
  old: {
    Id: string,
    Status: string,
  },
}
```

Status is one of the following: `NEW`, `SUBMITTED`, `PROGRESSING`,
`COMPLETE`, `CANCELED` or `ERROR`.

#### Connector actions

### <name="cancelJob"></a>Cancel Job action

_Definition:_

```ts
(
  job: Job,
) => void
```

_Usage:_

```js
await awsMediaConvertConnector.cancelJob(job);
```

Cancel a transcoding job, using the job object returned when the job was
created.

### <name="cancelJobById"></a>Cancel Job By Id action

_Definition:_

```ts
(
  id: string,
) => void
```

_Usage:_

```js
await awsMediaConvertConnector.cancelJobById('...');
```

Cancel a transcoding job, using its Id.

### <name="createJob"></a>Create Job action

_Definition:_

```ts
(
  params: object,
) => Job
```

_Usage:_

```js
const job = await awsMediaConvertConnector.createJob({
  // ...
});
```

Create a new transcoding job using the parameters and returning the job
information as defined by the
[AWS DSK](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html#createJob-property).

### <name="createSimpleJob"></a>Create Simple Job action

_Definition:_

```ts
(
  input: object,
  outputGroup: object,
  settings?: object,
) => Job
```

_Usage:_

```js
const job = await awsMediaConvertConnector.createSimpleJob({
  // ...
});
```

Create a simple transcoding job using the `input` and `outputGroup` arguments,
and returning the job information as defined by the
[AWS DSK](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html#createJob-property).

The optional `settings` argument allows the caller to define additional
transcoding settings like `Crop`, `Position` or `PsiControl` as defined by
the SDK.

### <name="createSingleJob"></a>Create Single Job action

_Definition:_

```ts
(
  src: string,
  dst: string,
  output: object,
  settings?: object,
) => Job
```

_Usage:_

```js
const job = await awsMediaConvertConnector.createSingleJob(
  `s3://<source-bucket>/<source-file>`,
  `s3://<target-bucket>/<target-file>`,
  {
    VideoDescription: {
      CodecSettings: {
        Codec: 'H_264',
        H264Settings: {
          Bitrate: 10000,
        },
      },
    },
    ContainerSettings: {
      Container: 'MP4',
    },
  },
);
```

Create a transcoding job for processing a single video file. The `src` and
`dst` arguments are S3 URLs poiting to the original and the transcoded video
files respectively. The `output` aregument is a single out object as defined
by the
[AWS DSK](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html#createJob-property).

The optional `settings` argument allows the caller to define additional
transcoding settings like `Crop`, `Position` or `PsiControl` as defined by
the SDK.

### <name="getJobStatus"></a>Get Job Status action

_Definition:_

```ts
(
  job: object,
) => object
```

_Usage:_

```js
const job = await awsMediaConvertConnector.createJob(...);
const status = await awsMediaConvertConnector.getJobStatus(job);
```

Get the status of a transcoding job, as defined by the
[AWS SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html#getJob-property).

### <name="getJobStatusById"></a>Get Job Status By Id action

_Definition:_

```ts
(
  id: string,
) => object
```

_Usage:_

```js
const job = await awsMediaConvertConnector.createJob(...);
const status = await awsMediaConvertConnector.getJobStatusById(job.Id);
```

Get the status of a transcoding job by the job Id, as defined by the
[AWS SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html#getJob-property).

### <name="listJobs"></a>List Jobs action

_Definition:_

```ts
() => object[]
```

_Usage:_

```js
const jobs = await awsMediaConvertConnector.listJobs();
for (job of jobs) {
  console.log(job);
}
```

Get information on past and active transcoding jobs as defined
[here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html#listJobs-property).

### <name="listJobsById"></a>List Jobs By Id action

_Definition:_

```ts
() => object
```

_Usage:_

```js
const jobs = await awsMediaConvertConnector.listJobsById();
for (id in jobs) {
  console.log(jobs[id]);
}
```

Get information on past and active transcoding jobs as defined
[here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MediaConvert.html#listJobs-property),
indexed by job Id.

#### SDK Details

##### <a name="sdk"></a>SDK action

_Definition:_

```ts
(
  options ?: object,
) => object
```

_Usage:_

```js
const mc = await awsMediaConvertConnector.sdk()
```

Get the underlying SDK object. You can specify additional options to override
or add to the required fields in the connector's configuration.
