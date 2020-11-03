import fs from 'fs'
import util from 'util'
import crypto from 'crypto'
import stream from 'stream'
import AWS from 'aws-sdk'
import fetch from 'node-fetch'
import { Folder } from './Folder'

const pipeline = util.promisify(stream.pipeline)

AWS.config.signatureVersion = 'v4'

export async function handler(event: any) {
  console.log('Running command:', event.command)
  console.log('URLs:', event.urls)

  const s3 = new AWS.S3()

  // Get the bucket and key out of an S3 URL
  function splitS3Url(url: string): string[] {
    const match: any = url.match(/^s3:\/\/(.*)\/(.*)$/)
    if (!match) {
      throw new Error(`Invalid file: ${url}`)
    }
    return [match[1], match[2]]
  }

  // Copy an object from S3 to a local folder
  async function getObjectFromS3(folder: Folder, url: string) {
    const [Bucket, Key] = splitS3Url(url)
    await pipeline(
      s3.getObject({ Bucket, Key }).createReadStream(),
      fs.createWriteStream(folder.path(Key)),
    )
  }

  // Split URL into hostname+path and filename
  function splitUrl(url: string): string[] {
    const index = url.lastIndexOf('/') + 1
    return [url.substr(0, index), url.substr(index)]
  }

  // Download an object through a URL
  async function downloadObject(folder: Folder, fn: string, url: string) {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Error ${res.status} ${res.statusText}: ${url}`)
    }
    await pipeline(
      res.body,
      fs.createWriteStream(folder.path(fn)),
    )
  }

  // Cache the executable from S3 or URL into a local folder
  const exeFolder = new Folder('executable', true)
  const executable: string = process.env.EXECUTABLE!
  console.log('Executable:', executable)
  const s3exe = executable.startsWith('s3')
  const exe = s3exe ? splitS3Url(executable)[1] : splitUrl(executable)[1]
  if (await exeFolder.contains(exe)) {
    console.log('Found executable:', exe)
  } else {
    if (s3exe) {
      console.log('Copying executable from S3:', executable)
      await getObjectFromS3(exeFolder, executable)
    } else {
      console.log('Downloading executable from:', executable)
      await downloadObject(exeFolder, exe, executable)
    }
    await exeFolder.exec(`chmod 0755 ${exe}`)
  }

  // Create a temportary folder for data files
  console.log('Creating temporary folder')
  const uid = crypto.randomBytes(8).toString('hex')
  const filesFolder = new Folder(uid)
  await filesFolder.init()

  try {

    // Load data files into temporary folder
    for (const url of event.urls) {
      console.log('Loading data:', url)
      await getObjectFromS3(filesFolder, url)
    }

    // Run the cached executable on the loaded files
    const command = event.command.replace(exe, exeFolder.path(exe))
    console.log('Running command:', command)
    const { stdout } = await filesFolder.exec(command)

    // Return the standard output
    console.log('Output:', stdout)
    return { statusCode: 200, body: stdout }

  } finally {
    // Cleanup data files
    await filesFolder.destroy()
  }
}

// process.env.EXECUTABLE =
//   // s3: 's3://reshuffle-files/mediainfo',
//   'http://reshuffle-files.s3-website-us-west-1.amazonaws.com/mediainfo'
// handler({
//   command: 'mediainfo --output=JSON lemons.mp4',
//   urls: [
//     `s3://${process.env.S3_SOURCE_BUCKET}/lemons.mp4`,
//   ],
// })
