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
