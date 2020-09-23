const { Reshuffle } = require('reshuffle')
const { AWSS3Connector, AWSLambdaConnector } = require('reshuffle-aws-connectors')

;(async () => {

  // Set up the app and connect to AWS services Lambda and S3
  const app = new Reshuffle()
  const options = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_DEFAULT_REGION,
    bucket: process.env.AWS_DEFAULT_BUCKET,
  }
  const lambda = new AWSLambdaConnector(app, options)
  const s3 = new AWSS3Connector(app, options)

  // Create a Lambda function to run the mediainfo command line utility. First
  // time this runs could take about a minute
  console.log('Creating Lambda for mediainfo (this could take up to one minute)')
  await lambda.createCommandFunction(
    'reshuffle-command-mediainfo',
    { url: 'http://reshuffle-files.s3-website-us-west-1.amazonaws.com/mediainfo' },
  )
  console.log('Lambda created')

  // Watch for new files uploaded to S3
  s3.on({ type: 'ObjectAdded' }, async (event) => {
    const filename = event.key
    if (filename.endsWith('.json')) {
      return
    }
    console.log('New file:', filename)

    // Run mediainfo on Lambda to get video details
    const mediaInfo = await lambda.command(
      'reshuffle-command-mediainfo',
      `mediainfo --output=JSON ${filename}`,
      await s3.getS3URL(filename),
    )

    // Get video track information
    const videoInfo = mediaInfo.media.track.find(e => e['@type'] === 'Video')
    if (!videoInfo) {
      console.log('Not a video file:', filename)
      return
    }

    // Write video info back to S3
    console.log(`${filename}: ${videoInfo.Width} x ${videoInfo.Height}`)
    console.log(`Get more info at: ${await s3.getS3URL(`${filename}.json`)}`)
    await s3.putObject(`${filename}.json`, Buffer.from(JSON.stringify(videoInfo)))

    // Cleanup after 60 seconds
    setTimeout(async () => {
      console.log('Cleaning up:', filename)
      await s3.deleteObject(filename)
      await s3.deleteObject(`${filename}.json`)
      console.log('Clean')
    }, 60000)
  })

  app.start(8000)
})()
