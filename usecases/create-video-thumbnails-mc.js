const path = require('path')
const { HttpConnector, Reshuffle } = require('reshuffle')
const {
  AWSLambdaConnector,
  AWSMediaConvertConnector,
  AWSS3Connector,
} = require('reshuffle-aws-connectors')

// Get your AWS account access key and select a region for this workflow

const ACCOUNT = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}
const REGION = process.env.AWS_DEFAULT_REGION

// Before you run, set up S3:
// 1. Create an S3 bucket
// 2. Open the source bucket for public access
//
// To run:
// 1. Drop your video files into the source bucket
// 2. the video thumbnails will be generated in the target bucket

const BUCKET = process.env.AWS_DEFAULT_BUCKET

// Create a Reshuffle application

const app = new Reshuffle()

// Create connections HTTP, Lambda, MediaConvert and S3

const http = new HttpConnector(app)
const lambda = new AWSLambdaConnector(app, { ...ACCOUNT, region: REGION })
const mc = new AWSMediaConvertConnector(app, { ...ACCOUNT, region: REGION })
const s3 = new AWSS3Connector(app, { ...ACCOUNT, bucket: BUCKET })

// When a new file is updaloaded to the S3 source bucket, use Lambda to
// run the mediainfo utility. Then according to the video picture size,
// either start a tanscoding job to generate thumbnail or simply copy
// the file to the target bucket

s3.on({ type: 'ObjectAdded' }, async (event) => {
  // Get the file name and create the thumbnail name

  const filename = event.key
  console.log('New file:', filename)

  // Ignore thumbnail videos we generated ourselves
  if (filename.endsWith('-thumbnail.mp4')) {
    console.log('Ignoring thumbnail:', filename)
    return
  }
  const thumbnail = `${filename}-thumbnail.mp4`
  console.log('Creating thumbnail:', filename, '->', thumbnail)

  // Run MediaInfo on Lambda to get video details (first time could take
  //  a minute to deploy the Lambda function)

  const mediaInfo = await lambda.command(
    'reshuffle-command-mediainfo',
    'http://reshuffle-files.s3-website-us-west-1.amazonaws.com/mediainfo',
    `mediainfo --output=JSON ${path.basename(filename)}`,
    await s3.getS3URL(filename),
  )

  const videoInfo =
    mediaInfo &&
    mediaInfo.media &&
    mediaInfo.media.track &&
    mediaInfo.media.track.find((e) => e['@type'] === 'Video')

  if (!videoInfo) {
    console.log('Not a video file:', filename)
    return
  }

  // Large files need to be transcoded into thumbnail size. Start
  // the transcoding job here. We'll need to track its status to
  // find out when the thumbnail is ready

  console.log(`Video picture size: ${videoInfo.Width} x ${videoInfo.Height}`)

  if (180 < videoInfo.Height) {
    // Calculate thumbnail size

    const height = 180
    const width = Math.ceil((videoInfo.Width * height) / videoInfo.Height) & 65534 // make even
    console.log(`Thumbnail size: ${width} x ${height}`)

    // Start transcoding to generate the video thumbnail

    console.log('Start transcoding job to generate thumbnail')
    const job = await mc.createSingleJob(
      `s3://${BUCKET}/${filename}`,
      `s3://${BUCKET}/${filename}-thumbnail`,
      {
        VideoDescription: {
          Height: height,
          Width: width,
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

    console.log('Transcoding job ID:', job.Id)
  }

  // Small enough files are simply copied. Copy is faily fast so
  // we can wait for it to complete and then the thumbnail is ready
  else {
    await s3.copyObject(S3_SOURCE_BUCKET, filename, S3_TARGET_BUCKET, thumbnail)
    console.log('Original copied to thumbnail:', thumbnail)
  }
})

// Track events from Elastic Transcoder to find out when the
// thumbnail is ready

mc.on({ type: 'JobStatusChanged' }, async (event) => {
  console.log(`Job progress ${event.jobId}: ${event.old.Status} -> ${event.current.Status}`)
})

// Expose an API endpoint, returning a list of all thumbnail videos

http.on({ method: 'GET', path: '/thumbnails' }, async (event) => {
  const keys = await s3.listObjectKeys(BUCKET)
  const thumbs = keys.filter((key) => key.endsWith('-thumbnail.mp4'))
  event.res.json(thumbs)
})

// Let the games begin...

app.start(8000)
