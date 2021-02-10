# AWS Connectors

This package contains [Reshuffle](https://github.com/reshufflehq/reshuffle)
connectors to (some of the) services available from AWS. These connectors are
all implemented using the
[AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/).

## Connectors

* [AWS Elastic Transcoder Connector](doc/AWSElasticTranscoderConnector.md)

* [AWS Lambda Connector](doc/AWSLambdaConnector.md)

* [AWS Media Convert](doc/AWSMediaConvertConnector.md)

* [AWS S3 Connector](doc/AWSS3Connector.md)

* [AWS SNS Connector](doc/AWSSNSConnector.md)

* [AWS SQS Connector](doc/AWSSQSConnector.md)

* [AWS Connector](doc/AWSConnector.md)

## Examples

* [Elastic Transcoder](examples/elastic-transcoder.js)

* [Lambda: Create and invoke](examples/lambda-create-invoke.js)

* [Lambda: Enqueue tasks](examples/lambda-enqueue-tasks.js)

* [Media Convert](examples/media-convert.js)

* [S3: List files](examples/s3-list-files.js)

* [S3: Watch files](examples/s3-watch-files.js)

* [S3+Lambda: Video info](examples/s3-lambda-video-info.js)

* [SNS: send messages](https://github.com/reshufflehq/reshuffle/blob/master/examples/aws/sns-messages.js)

* [SQS: send messages](https://github.com/reshufflehq/reshuffle/blob/master/examples/aws/sqs-messages.js)

* [AWS SDK: List S3 buckets](examples/aws-s3-sdk.js)

## Use Cases

* [Create video thumbnails (Elastic Transcoder)](usecases/create-video-thumbnails-et.md)

* [Create video thumbnails (Media Convert)](usecases/create-video-thumbnails-mc.md)

## Learn more

You can learn more about Reshuffle on
[dev.reshuffle.com](https://dev.reshuffle.com).
