import os from 'os'
import util from 'util'
import JSZip from 'jszip'
import ospath from 'path'
import rimraf from 'rimraf'
import { promises as fs } from 'fs'
import childProcess from 'child_process'

const exec = util.promisify(childProcess.exec)

export class Folder {
  private base: string
  private didInitializeDirectory = false

  constructor(name: string, private recursive = false) {
    this.base = ospath.join(os.tmpdir(), name)
  }

  public async copy(targetName: string, sourcePath: string) {
    await this.init()
    return fs.copyFile(sourcePath, `${this.base}/${targetName}`)
  }

  public async destroy() {
    await rimraf.sync(this.base)
    this.didInitializeDirectory = false
  }

  public async exec(cmd: string) {
    await this.init()
    return exec(`cd ${this.base} && ${cmd}`)
  }

  public async contains(filename: string): Promise<boolean> {
    await this.init()
    try {
      await fs.stat(this.path(filename))
      return true
    } catch (e) {
      if (e.code === 'ENOENT') {
        return false
      }
      throw e
    }
  }

  public async init() {
    if (!this.didInitializeDirectory) {
      const options = this.recursive ? { recursive: true } : undefined
      await fs.mkdir(this.base, options)
      this.didInitializeDirectory = true
    }
  }

  public path(name: string): string {
    return ospath.join(this.base, name)
  }

  public async write(targetName: string, data: string) {
    await this.init()
    return fs.writeFile(`${this.base}/${targetName}`, data, 'utf-8')
  }

  public async zip(options: any = {}): Promise<Buffer> {
    const zip = new JSZip()

    const addFilesInDirectory = async (dir = '') => {
      const files = await fs.readdir(this.path(dir))
      for (const file of files) {
        const path = ospath.join(dir, file)
        const st = await fs.stat(this.path(path))
        if (st.isDirectory()) {
          await addFilesInDirectory(path)
        } else {
          const data = await fs.readFile(this.path(path), 'utf-8')
          zip.file(path, data)
        }
      }
    }

    await addFilesInDirectory()

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
      ...options,
    }) as Promise<Buffer>
  }
}

export async function zipOne(filename: string, data: string): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(filename, data)
  return zip.generateAsync({ type: 'nodebuffer' })
}
