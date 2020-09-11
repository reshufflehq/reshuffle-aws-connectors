import fs from 'fs'
import util from 'util'
import crypto from 'crypto'
import stream from 'stream'
import AWS from 'aws-sdk'
import { Folder } from './Folder'

const pipeline = util.promisify(stream.pipeline)

AWS.config.signatureVersion = 'v4'

export async function handler(event: any) {
  console.log('Running command:', event.command)
  console.log('URLs:', event.urls)

  const s3 = new AWS.S3()

  // Get the buckey and key out of an S3 URL
  function splitUrl(url: string): string[] {
    const match: any = url.match(/^s3:\/\/(.*)\/(.*)$/)
    if (!match) {
      throw new Error(`Invalid file: ${url}`)
    }
    return [match[1], match[2]]
  }

  // Copy an object from S3 to a local folder
  async function getObject(folder: Folder, url: string) {
    const [Bucket, Key] = splitUrl(url)
    await pipeline(
      s3.getObject({ Bucket, Key }).createReadStream(),
      fs.createWriteStream(folder.path(Key)),
    )
  }

  // Cache the executable from S3 into a local folder
  const exeFolder = new Folder('executable', true)
  const exeUrl = process.env.EXECUTABLE!
  const [_exeBucket, exeKey] = splitUrl(exeUrl)
  if (await exeFolder.has(exeKey)) {
    console.log('Found executable:', exeUrl)
  } else {
    console.log('Loading executable:', exeUrl)
    await getObject(exeFolder, exeUrl)
    await exeFolder.exec(`chmod 0755 ${exeKey}`)
  }

  // Create a temportary forlder for data files
  console.log('Creating temporary folder')
  const uid = crypto.randomBytes(8).toString('hex')
  const filesFolder = new Folder(uid)
  await filesFolder.init()

  try {

    // Load data files into temporary folder
    for (const url of event.urls) {
      console.log('Loading data:', url)
      await getObject(filesFolder, url)
    }

    // Run the cached executable on the loaded files
    console.log('Running command')
    const command = exeFolder.path(event.command)
    const { stdout } = await filesFolder.exec(command)

    // Return the stadard output
    console.log('Output:', stdout)
    return { statusCode: 200, body: stdout }

  } finally {
    // Cleanup data files
    await filesFolder.destroy()
  }
}

// handler({
//   command: 'mediainfo --output=JSON lemons.mp4',
//   urls: [
//     `s3://${process.env.S3_SOURCE_BUCKET}/lemons.mp4`,
//   ],
// })
