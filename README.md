# AWS Connectors

This package contains [Resshufle](https://github.com/reshufflehq/reshuffle)
connectors to (some of the) services available from AWS. These connectors are
the implemented using the
[AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/).

## Connectors

* [AWS Elastic Transcoder Connector](doc/AWSElasticTranscoderConnector.md)

* [AWS Lambda Connector](doc/AWSLambdaConnector.md)

* [AWS S3 Connector](doc/AWSS3Connector.md)

## Examples

* [Elastic Transcoder](examples/elastic-transcoder.js)

* [Lambda: Create and invoke](examples/lambda-create-invoke.js)

* [Lambda: Enqueue tasks](examples/lambda-enqueue-tasks.js)

* [S3: List files](examples/s3-list-files.js)

* [S3: Watch files](examples/s3-watch-files.js)

* [S3+Lambda: Video info](examples/s3-lambda-video-info.js)

## Use Cases

* [Create video thumbnails](usecases/create-video-thumbnails.md)

## Learn more

You can learn more about Reshuffle on
[dev.reshuffle.com](https://dev.reshuffle.com).
