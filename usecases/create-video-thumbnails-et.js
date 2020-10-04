const {
  HttpConnector,
  MemoryStoreAdapter,
  Reshuffle,
} = require('reshuffle')

const {
  AWSElasticTranscoderConnector,
  AWSLambdaConnector,
  AWSS3Connector,
} = require('reshuffle-aws-connectors')

// Get your AWS account access key and select a region for this workflow

const AWS_ACCOUNT = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}
const AWS_REGION = process.env.AWS_DEFAULT_REGION

// Before you run, set up S3:
// 1. Create two S3 buckets
// 2. Open the source bucket for public access
//
// To run:
// 1. Drop your video files into the source bucket
// 2. the video thumbnails will be generated in the target bucket

const S3_SOURCE_BUCKET = process.env.S3_SOURCE_BUCKET
const S3_TARGET_BUCKET = process.env.S3_TARGET_BUCKET

// Create an Elastic Transcoder pipeline and configure it to use the S3
// buckets your created above

const ELASTIC_TRANSCODER_PIPELINE = process.env.ELASTIC_TRANSCODER_PIPELINE

// Create a Reshuffle application

const app = new Reshuffle()

// To persist connector state to a file use:
//   app.setPersistentStore(new FileStoreAdapter('./DATABASE'))
//
// To persist to PostgreSQL use:
//    const { Pool } = require('pg')
//    const pool = new Pool({ connectionString: 'postgresql://...' })
//    app.setPersistentStore(new SQLStoreAdapter(pool, 'tableName'))
//
// This will allow connectors to track their state in memory:

app.setPersistentStore(new MemoryStoreAdapter())

async function main() {

  // Create connections to Elastic Transcoder, Lambda and S3

  const aet = new AWSElasticTranscoderConnector(app, {
    ...AWS_ACCOUNT,
    region: AWS_REGION,
  })
  const lambda = new AWSLambdaConnector(app, {
    ...AWS_ACCOUNT,
    region: AWS_REGION,
  })
  const s3 = new AWSS3Connector(app, {
    ...AWS_ACCOUNT,
    bucket: S3_SOURCE_BUCKET,
  })

  // Create a Lambda function to run the mediainfo utility

  await lambda.createCommandFunction(
    'reshuffle-command-mediainfo',
    { url: 'http://reshuffle-files.s3-website-us-west-1.amazonaws.com/mediainfo' },
  )

  // Get transcoder pipeline and preset info

  const pipeline = await aet.findPipelineByName(ELASTIC_TRANSCODER_PIPELINE)
  const preset = await aet.findPresetByDescription('240')

  // When a new file is updaloaded to the S3 source bucket, use Lambda to
  // run the mediainfo utility. Then according to the video picture size,
  // either start a tanscoding job to generate thumbnail or simply copy
  // the file to the target bucket

  s3.on({ type: 'ObjectAdded' }, async (event) => {

    // Get the file name and create the thumbnail name

    const filename = event.key
    const thumbnail = `${filename}-thumbnail.mp4`
    console.log('Creating thumbnail:', filename, '->', thumbnail)

    // Run MediaInfo on Lambda to get video details

    const url = await s3.getS3URL(filename)
    const mediaInfo = await lambda.command(
      'reshuffle-command-mediainfo',
      `mediainfo --output=JSON ${filename}`,
      url,
    )
    const video = mediaInfo.media.track.find(e => e['@type'] === 'Video')

    if (!video) {
      console.log('Not a video file:', filename)
      return
    }

    // Large files need to be transcoded into thumbnail size. Start
    // the transcoding job here. We'll need to track its status to
    // find out when the thumbnail is ready

    console.log(`Video picture size: ${video.Width} x ${video.Height}`)

    if (240 < video.Height) {
      console.log('Transcoding video to thumbnail:', thumbnail)
      const job = await aet.createJob({
        PipelineId: pipeline.Id,
        Input: {
          Key: filename,
        },
        Output: {
          PresetId: preset.Id,
          Key: thumbnail,
        },
      })
      console.log('Transcoding job started:', job.Id)
    }

    // Small enough files are simply copied. Copy is faily fast so
    // we can wait for it to complete and then the thumbnail is ready

    else {
      await s3.copyObject(
        S3_SOURCE_BUCKET,
        filename,
        S3_TARGET_BUCKET,
        thumbnail,
      )
      console.log('Original copied to thumbnail:', thumbnail)
    }
  })

  // Track events from Elastic Transcoder to find out when the
  // thumbnail is ready

  aet.on({ pipelineId: pipeline.Id }, async (event) => {
    console.log(`Trancoding job ${event.jobId}: ${
      event.old.Status || 'New'} -> ${event.current.Status}`)

    if (event.current.Status === 'Complete') {
      console.log('Created thumbnail:', event.current.Output.Key)
    }
  })

  // Use the HTTP connector to create an API endpoint, returning a list
  // of all thumbnail videos

  const http = new HttpConnector(app)

  http.on({ method: 'GET', path: '/thumbnails' }, async (event) => {
    const keys = await s3.listObjectKeys(S3_TARGET_BUCKET)
    event.context.res.json(keys)
  })

  // Let the games begin...

  app.start(8000)
}

main()
