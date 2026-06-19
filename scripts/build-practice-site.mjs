import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendDir = path.join(rootDir, 'frontend')
const exportDir = path.join(rootDir, 'data', 'export')
const outDir = path.join(rootDir, 'dist', 'practice-site')
const publicPracticeDir = path.join(frontendDir, 'public', 'practice-data')
const selectedSongIds = parseSongIds(process.argv.slice(2))

await rm(publicPracticeDir, { recursive: true, force: true })
await mkdir(path.join(publicPracticeDir, 'songs'), { recursive: true })
await mkdir(path.join(publicPracticeDir, 'audio'), { recursive: true })

const manifest = await preparePracticeData()

if (!manifest.songs.length) {
  throw new Error('No songs were exported')
}

await writeFile(path.join(publicPracticeDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await rm(outDir, { recursive: true, force: true })
await runFrontendBuild()
await rm(publicPracticeDir, { recursive: true, force: true })

console.log(`Exported ${manifest.songs.length} song(s) to ${path.relative(rootDir, outDir)}`)

async function preparePracticeData() {
  const exportFiles = await readdir(exportDir)
  const songFiles = exportFiles.filter((file) => file.endsWith('.json')).sort()
  const songs = []

  for (const file of songFiles) {
    const sourcePath = path.join(exportDir, file)
    const song = JSON.parse(await readFile(sourcePath, 'utf8'))

    if (selectedSongIds.size && !selectedSongIds.has(song.id)) {
      continue
    }

    const audioPath = resolveAudioPath(song.audio?.playbackUrl)
    if (!(await fileExists(audioPath))) {
      if (selectedSongIds.size) {
        throw new Error(`Audio file not found for ${song.id}: ${audioPath}`)
      }
      console.warn(`Skipped ${song.id}: audio file not found at ${audioPath}`)
      continue
    }

    const audioExt = path.extname(audioPath) || '.mp3'
    const audioFileName = `${song.id}${audioExt}`
    const staticSong = {
      ...song,
      audio: {
        ...song.audio,
        playbackUrl: `./practice-data/audio/${audioFileName}`,
      },
    }

    await cp(audioPath, path.join(publicPracticeDir, 'audio', audioFileName))
    await writeFile(path.join(publicPracticeDir, 'songs', `${song.id}.json`), `${JSON.stringify(staticSong, null, 2)}\n`)
    songs.push({
      id: song.id,
      title: song.title,
      artist: song.artist,
      hasLyrics: Array.isArray(song.lyrics) && song.lyrics.length > 0,
      hasTranslation: Array.isArray(song.lyrics) && song.lyrics.some((line) => Boolean(line.translation?.trim())),
      hasNotes: Array.isArray(song.lyrics) && song.lyrics.some((line) => Array.isArray(line.notes) && line.notes.length > 0),
      playerPath: `/player/${song.id}`,
      songUrl: `./practice-data/songs/${song.id}.json`,
      audioUrl: `./practice-data/audio/${audioFileName}`,
    })
  }

  return { songs }
}

function parseSongIds(args) {
  const songsArg = args.find((arg) => arg.startsWith('--songs='))
  if (!songsArg) {
    return new Set()
  }

  return new Set(songsArg.slice('--songs='.length).split(',').map((id) => id.trim()).filter(Boolean))
}

function resolveAudioPath(playbackUrl) {
  if (!playbackUrl || typeof playbackUrl !== 'string') {
    throw new Error('Song is missing audio.playbackUrl')
  }
  if (playbackUrl.startsWith('/media/raw/')) {
    return path.join(rootDir, 'data', 'raw', decodeMediaPath(playbackUrl.slice('/media/raw/'.length)))
  }
  if (playbackUrl.startsWith('/media/normalized/')) {
    return path.join(rootDir, 'data', 'normalized', decodeMediaPath(playbackUrl.slice('/media/normalized/'.length)))
  }
  if (playbackUrl.startsWith('/')) {
    return path.join(rootDir, playbackUrl.slice(1))
  }
  return path.resolve(rootDir, playbackUrl)
}

function decodeMediaPath(mediaPath) {
  try {
    return decodeURIComponent(mediaPath)
  } catch {
    return mediaPath
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function runFrontendBuild() {
  await run('npx', ['tsc', '-b'], { VITE_PRACTICE_MODE: '1' })
  await run('npx', ['vite', 'build', '--base=./', '--outDir', '../dist/practice-site', '--emptyOutDir'], { VITE_PRACTICE_MODE: '1' })
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: frontendDir,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
    })
  })
}
