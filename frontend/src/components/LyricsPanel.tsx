import { Fragment, useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/time'
import type { SongLyricLine } from '../types/api'

type ChantPlacement = 'inline' | 'before-line' | 'after-line' | 'after-phrase' | 'replace-phrase'

interface ChantAnchor {
  matchText: string
  occurrence: number
  charStart: number
  charEnd: number
  sourceMark?: string
}

interface ChantNote {
  type: 'chant'
  mode: 'inline' | 'standalone'
  label: 'chant' | 'sing-along'
  text: string
  placement: ChantPlacement
  anchor: ChantAnchor | null
}

interface LyricsPanelProps {
  lyrics: SongLyricLine[]
  activeLineId?: string
  selectedEditLineId?: string | null
  showTranslation: boolean
  autoScroll: boolean
  isEditing?: boolean
  onToggleTranslation?: () => void
  onToggleAutoScroll?: () => void
  onToggleEditing?: () => void
  onSeekToLine?: (line: SongLyricLine) => void
  onSelectEditLine?: (line: SongLyricLine) => void
  onUpdateStandaloneChant?: (line: SongLyricLine, noteIndex: number, text: string) => void
}

export function LyricsPanel({
  lyrics,
  activeLineId,
  selectedEditLineId,
  showTranslation,
  autoScroll,
  isEditing = false,
  onToggleTranslation,
  onToggleAutoScroll,
  onToggleEditing,
  onSeekToLine,
  onSelectEditLine,
  onUpdateStandaloneChant,
}: LyricsPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLDivElement | null>(null)
  const [editingChantKey, setEditingChantKey] = useState<string | null>(null)

  useEffect(() => {
    if (!autoScroll || !listRef.current || !activeRef.current) {
      return
    }

    const list = listRef.current
    const activeLine = activeRef.current
    const nextTop = activeLine.offsetTop - list.clientHeight / 2 + activeLine.clientHeight / 2

    list.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [activeLineId, autoScroll])

  return (
    <section className="lyrics-card">
      <div className="player-topline">
        <div>
          <h2>Lyrics flow</h2>
        </div>
        <div className="mode-bar">
          <button
            type="button"
            className={`chip-button chip-button--compact${showTranslation ? ' is-active' : ''}`}
            onClick={onToggleTranslation}
          >
            Translation {showTranslation ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className={`chip-button chip-button--compact${autoScroll ? ' is-active' : ''}`}
            onClick={onToggleAutoScroll}
          >
            Auto-scroll {autoScroll ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className={`chip-button chip-button--compact${isEditing ? ' is-active' : ''}`}
            onClick={onToggleEditing}
          >
            {isEditing ? 'Done editing' : 'Edit lyrics'}
          </button>
        </div>
      </div>

      <div ref={listRef} className="lyrics-list">
        {lyrics.map((line) => {
          const isActive = line.id === activeLineId
          const isSelectedForEdit = line.id === selectedEditLineId

          return (
            <div
              key={line.id}
              ref={isActive ? activeRef : null}
              role="button"
              tabIndex={0}
              className={`lyric-line${isActive ? ' lyric-line--active' : ''}${isSelectedForEdit ? ' lyric-line--selected-edit' : ''}`}
              onClick={() => {
                if (isEditing) {
                  onSelectEditLine?.(line)
                  return
                }

                onSeekToLine?.(line)
              }}
              onKeyDown={(event) => {
                if (isTextEditingTarget(event.target)) {
                  return
                }

                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }

                event.preventDefault()
                if (isEditing) {
                  onSelectEditLine?.(line)
                  return
                }

                onSeekToLine?.(line)
              }}
            >
              <span className="lyric-line__time">
                {formatTime(line.start)} - {formatTime(line.end)}
              </span>
              {renderChants(line, 'before-line', isEditing, editingChantKey, setEditingChantKey, onUpdateStandaloneChant)}
              <span className="lyric-line__text">{renderLyricText(line)}</span>
              {showTranslation && line.translation ? (
                <span className="lyric-line__translation">{line.translation}</span>
              ) : null}
              {renderChants(line, 'after-line', isEditing, editingChantKey, setEditingChantKey, onUpdateStandaloneChant)}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function renderLyricText(line: SongLyricLine) {
  const anchoredNotes = getChantNotes(line).filter(hasRenderableAnchor)

  if (anchoredNotes.length === 0) {
    return line.text
  }

  const orderedNotes = anchoredNotes
    .filter((note) => isValidAnchor(line.text, note.anchor))
    .sort((left, right) => left.anchor.charStart - right.anchor.charStart)

  if (orderedNotes.length === 0) {
    return line.text
  }

  const parts = []
  let cursor = 0

  for (const note of orderedNotes) {
    if (note.anchor.charStart < cursor) {
      continue
    }

    if (cursor < note.anchor.charStart) {
      parts.push(line.text.slice(cursor, note.anchor.charStart))
    }

    const matchedText = line.text.slice(note.anchor.charStart, note.anchor.charEnd)
    parts.push(
      <Fragment key={`${note.anchor.charStart}-${note.anchor.charEnd}-${note.text}`}>
        <span className={note.placement === 'replace-phrase' ? 'chant-anchor chant-anchor--replace' : 'chant-anchor'}>
          {matchedText}
        </span>
        {note.placement === 'replace-phrase' || note.placement === 'after-phrase' ? (
          <span className={`chant-pill chant-pill--${note.label}`}>{note.text}</span>
        ) : null}
      </Fragment>,
    )
    cursor = note.anchor.charEnd
  }

  if (cursor < line.text.length) {
    parts.push(line.text.slice(cursor))
  }

  return parts
}

function isTextEditingTarget(target: EventTarget) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

function renderChants(
  line: SongLyricLine,
  placement: 'before-line' | 'after-line',
  isEditing: boolean,
  editingChantKey: string | null,
  setEditingChantKey: (value: string | null) => void,
  onUpdateStandaloneChant?: (line: SongLyricLine, noteIndex: number, text: string) => void,
) {
  const notes = getChantNoteEntries(line).filter(({ note }) => note.placement === placement)

  if (notes.length === 0) {
    return null
  }

  return (
    <span className={`chant-row chant-row--${placement}`}>
      {notes.map(({ note, noteIndex }) => {
        const chantKey = `${line.id}:${noteIndex}`
        const isEditingThisChant = editingChantKey === chantKey

        if (isEditing && isEditingThisChant) {
          return (
            <label key={`${placement}-${noteIndex}`} className="chant-edit-field" onClick={(event) => event.stopPropagation()}>
              <input
                className="field"
                value={note.text}
                autoFocus
                onChange={(event) => onUpdateStandaloneChant?.(line, noteIndex, event.target.value)}
                onBlur={() => setEditingChantKey(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.currentTarget.blur()
                  }
                }}
              />
            </label>
          )
        }

        return (
          <button
            key={`${placement}-${note.text}-${noteIndex}`}
            type="button"
            className={`chant-pill chant-pill--${note.label}${isEditing ? ' chant-pill--editable' : ''}`}
            onClick={(event) => {
              if (!isEditing) {
                return
              }

              event.stopPropagation()
              setEditingChantKey(chantKey)
            }}
          >
            {note.text}
          </button>
        )
      })}
    </span>
  )
}

function getChantNoteEntries(line: SongLyricLine): Array<{ note: ChantNote; noteIndex: number }> {
  const notes: Array<{ note: ChantNote; noteIndex: number }> = []

  line.notes.forEach((note, noteIndex) => {
    if (isChantNote(note)) {
      notes.push({ note, noteIndex })
    }
  })

  return notes
}

function getChantNotes(line: SongLyricLine): ChantNote[] {
  const notes: ChantNote[] = []

  for (const note of line.notes) {
    if (isChantNote(note)) {
      notes.push(note)
    }
  }

  return notes
}

function isChantNote(note: unknown): note is ChantNote {
  if (!note || typeof note !== 'object') {
    return false
  }

  const candidate = note as Record<string, unknown>
  return (
    candidate.type === 'chant' &&
    (candidate.mode === 'inline' || candidate.mode === 'standalone') &&
    (candidate.label === 'chant' || candidate.label === 'sing-along') &&
    typeof candidate.text === 'string' &&
    isChantPlacement(candidate.placement) &&
    (candidate.anchor === null || isChantAnchor(candidate.anchor))
  )
}

function hasRenderableAnchor(note: ChantNote): note is ChantNote & { anchor: ChantAnchor } {
  return note.anchor !== null && note.placement !== 'before-line' && note.placement !== 'after-line'
}

function isChantPlacement(value: unknown): value is ChantPlacement {
  return value === 'inline' || value === 'before-line' || value === 'after-line' || value === 'after-phrase' || value === 'replace-phrase'
}

function isChantAnchor(value: unknown): value is ChantAnchor {
  if (!value || typeof value !== 'object') {
    return false
  }

  const anchor = value as Record<string, unknown>
  return (
    typeof anchor.matchText === 'string' &&
    typeof anchor.occurrence === 'number' &&
    typeof anchor.charStart === 'number' &&
    typeof anchor.charEnd === 'number' &&
    (anchor.sourceMark === undefined || typeof anchor.sourceMark === 'string')
  )
}

function isValidAnchor(text: string, anchor: ChantAnchor) {
  return (
    Number.isInteger(anchor.charStart) &&
    Number.isInteger(anchor.charEnd) &&
    anchor.charStart >= 0 &&
    anchor.charEnd > anchor.charStart &&
    anchor.charEnd <= text.length &&
    text.slice(anchor.charStart, anchor.charEnd) === anchor.matchText
  )
}
