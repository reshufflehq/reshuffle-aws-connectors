const { HttpConnector, Reshuffle } = require('reshuffle')
const { AWSMediaConvertConnector } = require('reshuffle-aws-connectors')

async function main() {
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
}

main()
