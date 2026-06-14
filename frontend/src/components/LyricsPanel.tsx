import { Fragment, useEffect, useRef, useState, type MouseEvent } from 'react'
import { formatTime } from '../lib/time'
import type { SongLyricLine } from '../types/api'

type ChantPlacement = 'inline' | 'insert-at' | 'replace-phrase'

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

type UpdateChantText = (line: SongLyricLine, noteIndex: number, text: string) => void
type AddChantNote = (line: SongLyricLine, note: Record<string, unknown>) => void

interface LyricSelection {
  lineId: string
  text: string
  charStart: number
  charEnd: number
}

interface PendingChant {
  lineId: string
  selection: LyricSelection
  placement: 'insert-at' | 'replace-phrase'
  text: string
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
  onUpdateChantText?: UpdateChantText
  onAddChantNote?: AddChantNote
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
  onUpdateChantText,
  onAddChantNote,
}: LyricsPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLDivElement | null>(null)
  const [editingChantKey, setEditingChantKey] = useState<string | null>(null)
  const [lyricSelection, setLyricSelection] = useState<LyricSelection | null>(null)
  const [pendingChant, setPendingChant] = useState<PendingChant | null>(null)

  useEffect(() => {
    if (!autoScroll || !listRef.current || !activeRef.current) {
      return
    }

    const list = listRef.current
    const activeLine = activeRef.current
    const nextTop = activeLine.offsetTop - list.clientHeight / 2 + activeLine.clientHeight / 2

    list.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [activeLineId, autoScroll])

  useEffect(() => {
    if (!isEditing) {
      setEditingChantKey(null)
      setLyricSelection(null)
      setPendingChant(null)
    }
  }, [isEditing])

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
              className={`lyric-line${isActive ? ' lyric-line--active' : ''}${isEditing ? ' lyric-line--editing' : ''}${isSelectedForEdit ? ' lyric-line--selected-edit' : ''}`}
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
              <span
                className="lyric-line__text"
                onMouseUp={(event) => {
                  if (!isEditing) {
                    return
                  }

                  handleLyricTextMouseUp(line, event, setLyricSelection, setPendingChant)
                }}
              >
                {renderLyricText(
                  line,
                  isEditing,
                  editingChantKey,
                  setEditingChantKey,
                  onUpdateChantText,
                  pendingChant?.lineId === line.id ? pendingChant : null,
                  setPendingChant,
                  onAddChantNote,
                )}
              </span>
              {isEditing && lyricSelection?.lineId === line.id ? (
                <span className="chant-selection-toolbar" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="chip-button chip-button--compact" onClick={() => addSelectedChant(line, lyricSelection, 'inline', onAddChantNote, setLyricSelection)}>
                    歌詞內應援
                  </button>
                  <button type="button" className="chip-button chip-button--compact" onClick={() => startPendingChant(lyricSelection, 'replace-phrase', setPendingChant, setLyricSelection)}>
                    同時應援
                  </button>
                </span>
              ) : null}
              {showTranslation && line.translation ? (
                <span className="lyric-line__translation">{line.translation}</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function renderLyricText(
  line: SongLyricLine,
  isEditing: boolean,
  editingChantKey: string | null,
  setEditingChantKey: (value: string | null) => void,
  onUpdateChantText?: UpdateChantText,
  pendingChant?: PendingChant | null,
  setPendingChant?: (value: PendingChant | null) => void,
  onAddChantNote?: AddChantNote,
) {
  const anchoredNotes = getChantNoteEntries(line).filter(({ note }) => hasRenderableAnchor(note))
  const pendingEntry = pendingChant ? buildPendingChantEntry(pendingChant) : null

  if (anchoredNotes.length === 0 && !pendingEntry) {
    return line.text
  }

  const orderedNotes: Array<{
    note: ChantNote & { anchor: ChantAnchor }
    noteIndex: number
    isPending: boolean
  }> = anchoredNotes
    .filter((entry): entry is { note: ChantNote & { anchor: ChantAnchor }; noteIndex: number } => (
      hasRenderableAnchor(entry.note) && isValidAnchor(line.text, entry.note)
    ))
    .map((entry) => ({ ...entry, isPending: false }))

  if (pendingEntry && isValidAnchor(line.text, pendingEntry.note)) {
    orderedNotes.push(pendingEntry)
  }

  orderedNotes
    .sort((left, right) => left.note.anchor.charStart - right.note.anchor.charStart)

  if (orderedNotes.length === 0) {
    return line.text
  }

  const parts = []
  let cursor = 0

  for (const { note, noteIndex, isPending } of orderedNotes) {
    if (note.anchor.charStart < cursor) {
      continue
    }

    if (cursor < note.anchor.charStart) {
      parts.push(line.text.slice(cursor, note.anchor.charStart))
    }

    const matchedText = line.text.slice(note.anchor.charStart, note.anchor.charEnd)
    parts.push(
      <Fragment key={`${note.anchor.charStart}-${note.anchor.charEnd}-${note.text}`}>
        {note.placement === 'insert-at' ? null : (
          <span className={note.placement === 'replace-phrase' ? 'chant-anchor chant-anchor--replace' : 'chant-anchor'}>
            {matchedText}
          </span>
        )}
        {isPending && pendingChant && setPendingChant && onAddChantNote ? (
          renderPendingChantInput(line, pendingChant, setPendingChant, onAddChantNote)
        ) : note.placement === 'insert-at' ? (
          renderEditableChantText(line, note, noteIndex, isEditing, editingChantKey, setEditingChantKey, onUpdateChantText, true)
        ) : note.placement === 'replace-phrase' ? (
          renderEditableChantText(line, note, noteIndex, isEditing, editingChantKey, setEditingChantKey, onUpdateChantText, true)
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

function readLyricSelection(line: SongLyricLine, container: HTMLElement): LyricSelection | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  const selectedText = selection.toString()
  if (range.collapsed || !selectedText.trim() || !container.contains(range.commonAncestorContainer)) {
    return null
  }

  const charStart = getLyricTextOffset(container, range.startContainer, range.startOffset)
  const charEnd = getLyricTextOffset(container, range.endContainer, range.endOffset)

  if (charStart === null || charEnd === null || charEnd <= charStart) {
    return null
  }

  const anchoredText = line.text.slice(charStart, charEnd)
  if (anchoredText !== selectedText) {
    return null
  }

  return {
    lineId: line.id,
    text: anchoredText,
    charStart,
    charEnd,
  }
}

function handleLyricTextMouseUp(
  line: SongLyricLine,
  event: MouseEvent<HTMLElement>,
  setLyricSelection: (value: LyricSelection | null) => void,
  setPendingChant: (value: PendingChant | null) => void,
) {
  if (event.target instanceof HTMLElement && event.target.closest('.chant-pill, .chant-edit-field')) {
    return
  }

  const selection = readLyricSelection(line, event.currentTarget)
  if (selection) {
    setPendingChant(null)
    setLyricSelection(selection)
    return
  }

  const insertOffset = getClickLyricTextOffset(event.currentTarget, event.clientX, event.clientY)
  if (insertOffset === null) {
    setLyricSelection(null)
    return
  }

  setLyricSelection(null)
  setPendingChant({
    lineId: line.id,
    selection: {
      lineId: line.id,
      text: '',
      charStart: insertOffset,
      charEnd: insertOffset,
    },
    placement: 'insert-at',
    text: '',
  })
}

function getLyricTextOffset(container: HTMLElement, target: Node, targetOffset: number) {
  let offset = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const node = walker.currentNode
    const element = node.parentElement

    if (element?.closest('.chant-pill, .chant-edit-field')) {
      continue
    }

    if (node === target) {
      return offset + targetOffset
    }

    offset += node.textContent?.length ?? 0
  }

  return null
}

function getClickLyricTextOffset(container: HTMLElement, clientX: number, clientY: number) {
  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  const range = documentWithCaret.caretRangeFromPoint?.(clientX, clientY)
  if (!range || !container.contains(range.startContainer)) {
    const position = documentWithCaret.caretPositionFromPoint?.(clientX, clientY)
    if (!position || !container.contains(position.offsetNode)) {
      return null
    }

    return getLyricTextOffset(container, position.offsetNode, position.offset)
  }

  return getLyricTextOffset(container, range.startContainer, range.startOffset)
}

function addSelectedChant(
  line: SongLyricLine,
  selection: LyricSelection,
  placement: 'inline',
  onAddChantNote: AddChantNote | undefined,
  setLyricSelection: (value: LyricSelection | null) => void,
) {
  if (!onAddChantNote) {
    return
  }

  onAddChantNote(line, buildChantNote(line, selection, placement, selection.text))
  window.getSelection()?.removeAllRanges()
  setLyricSelection(null)
}

function startPendingChant(
  selection: LyricSelection,
  placement: 'replace-phrase',
  setPendingChant: (value: PendingChant | null) => void,
  setLyricSelection: (value: LyricSelection | null) => void,
) {
  setPendingChant({
    lineId: selection.lineId,
    selection,
    placement,
    text: selection.text,
  })
  window.getSelection()?.removeAllRanges()
  setLyricSelection(null)
}

function buildPendingChantEntry(pendingChant: PendingChant) {
  return {
    noteIndex: -1,
    isPending: true,
    note: {
      type: 'chant',
      mode: 'standalone',
      label: 'chant',
      text: pendingChant.text,
      placement: pendingChant.placement,
      anchor: {
        matchText: pendingChant.placement === 'insert-at' ? '' : pendingChant.selection.text,
        occurrence: pendingChant.placement === 'insert-at' ? 0 : 1,
        charStart: pendingChant.selection.charStart,
        charEnd: pendingChant.selection.charEnd,
      },
    } satisfies ChantNote & { anchor: ChantAnchor },
  }
}

function renderPendingChantInput(
  line: SongLyricLine,
  pendingChant: PendingChant,
  setPendingChant: (value: PendingChant | null) => void,
  onAddChantNote: AddChantNote,
) {
  const commitPendingChant = () => {
    const text = pendingChant.text.trim()
    if (!text) {
      setPendingChant(null)
      return
    }

    onAddChantNote(line, buildChantNote(line, pendingChant.selection, pendingChant.placement, text))
    setPendingChant(null)
  }

  return (
    <label className="chant-edit-field chant-edit-field--inline" onClick={(event) => event.stopPropagation()}>
      <input
        className="field"
        value={pendingChant.text}
        autoFocus
        placeholder="應援詞"
        onChange={(event) => setPendingChant({ ...pendingChant, text: event.target.value })}
        onBlur={commitPendingChant}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            setPendingChant(null)
          }
        }}
      />
    </label>
  )
}

function buildChantNote(
  line: SongLyricLine,
  selection: LyricSelection,
  placement: 'inline' | 'insert-at' | 'replace-phrase',
  text: string,
) {
  return {
    type: 'chant',
    mode: placement === 'inline' ? 'inline' : 'standalone',
    label: placement === 'inline' ? 'sing-along' : 'chant',
    text,
    placement,
    anchor: {
      matchText: placement === 'insert-at' ? '' : selection.text,
      occurrence: placement === 'insert-at' ? 0 : countPhraseOccurrence(line.text, selection.text, selection.charStart),
      charStart: selection.charStart,
      charEnd: selection.charEnd,
    },
  }
}

function countPhraseOccurrence(text: string, phrase: string, charStart: number) {
  let occurrence = 0
  let searchFrom = 0

  while (searchFrom <= charStart) {
    const nextIndex = text.indexOf(phrase, searchFrom)
    if (nextIndex === -1 || nextIndex > charStart) {
      break
    }

    occurrence += 1
    searchFrom = nextIndex + phrase.length
  }

  return Math.max(occurrence, 1)
}

function renderEditableChantText(
  line: SongLyricLine,
  note: ChantNote,
  noteIndex: number,
  isEditing: boolean,
  editingChantKey: string | null,
  setEditingChantKey: (value: string | null) => void,
  onUpdateChantText: UpdateChantText | undefined,
  isInline: boolean,
) {
  const chantKey = `${line.id}:${noteIndex}`
  const isEditingThisChant = editingChantKey === chantKey

  if (isEditing && isEditingThisChant) {
    return (
      <label
        key={`chant-edit-${noteIndex}`}
        className={`chant-edit-field${isInline ? ' chant-edit-field--inline' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          className="field"
          value={note.text}
          autoFocus
          onChange={(event) => onUpdateChantText?.(line, noteIndex, event.target.value)}
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
      key={`chant-${note.text}-${noteIndex}`}
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
  return note.anchor !== null
}

function isChantPlacement(value: unknown): value is ChantPlacement {
  return value === 'inline' || value === 'insert-at' || value === 'replace-phrase'
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

function isValidAnchor(text: string, note: ChantNote & { anchor: ChantAnchor }) {
  const { anchor } = note

  if (note.placement === 'insert-at') {
    return (
      Number.isInteger(anchor.charStart) &&
      Number.isInteger(anchor.charEnd) &&
      anchor.charStart === anchor.charEnd &&
      anchor.charStart >= 0 &&
      anchor.charStart <= text.length &&
      anchor.matchText === ''
    )
  }

  return (
    Number.isInteger(anchor.charStart) &&
    Number.isInteger(anchor.charEnd) &&
    anchor.charStart >= 0 &&
    anchor.charEnd > anchor.charStart &&
    anchor.charEnd <= text.length &&
    text.slice(anchor.charStart, anchor.charEnd) === anchor.matchText
  )
}
