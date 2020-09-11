# AWS Connectors

This package contains connectors to (some of the) services available from AWS. These connectors use the [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/).

## Connectors

* [AWS Elastic Transcoder Connector](doc/AWSElasticTranscoderConnector.md)

* [AWS Lambda Connector](doc/AWSLambdaConnector.md)

* [AWS S3 Connector](AWSS3Connector.md)

## Examples

* [Elastic Transcoder](examples/elastic-transcoder.js)

* [Lambda: Create and invoke](examples/lambda-create-invoke.js)

* [Lambda: Enqueue tasks](examples/lambda-enqueue-tasks.js)

* [S3: List files](examples/s3-list-files.js)

* [S3: Watch files](examples/s3-watch-files.js)

## Use Cases

### Create video thumbnails

[source](usecases/create-video-thumbnails.js)

Everyone knows how to create thumbnails for images. But can we do it for
videos? Surely this will take massive amounts of code, no?

Not with Reshuffle!

#### Ingredients:

* __2__ [S3](https://aws.amazon.com/s3/) buckets

* __1__ [Amazon Elastic Trasncoder](https://aws.amazon.com/elastictranscoder/) pipeline

* __1__ [mediainfo](https://mediaarea.net/en/MediaInfo) utility, [precompiled for lambda](https://mediaarea.net/download/binary/mediainfo/20.08/MediaInfo_CLI_20.08_Lambda.zip)

* __1__ Reshuffle

#### Preparation:

1. Create two S3 buckets: source and target. Open source for public read

1. Create an Elastic Transcoder pipeline to read from your source bucket and output into your target bucket

1. Set up the following environment variables:

  AWS_ACCESS_KEY_ID

  AWS_SECRET_ACCESS_KEY

  AWS_REGION

  AWS_BUCKET

  S3_SOURCE_BUCKET

  S3_TARGET_BUCKET

  ELASTIC_TRANSCODER_PIPELINE

#### Workflow:

1. Run [create-video-thumbnails.js](usecases/create-video-thumbnails.js) on Reshuffle

1. Drop video file into your source S3 bucket

1. Reshuffle picks it up and uses Lambda to run the MediaInfo command line utility to get information on the video

1. Reshuffle looks at video frame size infomation. If the frame is large,
Reshuffle starts transcoding job and tracks job until thumbnail is ready. If
it's small, Reshuffle simply copies the file into target bucket.

#### Bonus:

We also provide an API endpoint for listing all the generated thumbnail video files.
