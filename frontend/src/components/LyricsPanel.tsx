import { Fragment, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { formatTime } from '../lib/time'
import type { SongChantEvent, SongLyricLine } from '../types/api'

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
  romanizedText?: string
  placement: ChantPlacement
  anchor: ChantAnchor | null
}

type UpdateChantText = (line: SongLyricLine, noteIndex: number, text: string) => void
type DeleteChantNote = (line: SongLyricLine, noteIndex: number) => void
type AddChantNote = (line: SongLyricLine, note: Record<string, unknown>) => void
type SaveChantEvents = (events: SongChantEvent[]) => void

interface LyricSelection {
  lineId: string
  text: string
  charStart: number
  charEnd: number
}

interface SelectionPopover {
  lineId: string
  x: number
  y: number
}

interface ActiveLyricSelection {
  line: SongLyricLine
  container: HTMLElement
}

interface PendingChant {
  lineId: string
  selection: LyricSelection
  placement: 'insert-at' | 'replace-phrase'
  text: string
}

interface PendingChantEvent {
  position: 'intro' | 'outro'
  start: string
  end: string
  text: string
}

interface EditingChantEvent {
  id: string
  start: string
  end: string
  text: string
}

interface LyricsPanelProps {
  lyrics: SongLyricLine[]
  chantEvents?: SongChantEvent[]
  activeLineId?: string
  activeChantEventId?: string
  selectedEditLineId?: string | null
  showTranslation: boolean
  hasTranslation: boolean
  showChantRomanization: boolean
  autoScroll: boolean
  isEditing?: boolean
  onToggleTranslation?: () => void
  onToggleChantRomanization?: () => void
  onToggleAutoScroll?: () => void
  onToggleEditing?: () => void
  onSeekToLine?: (line: SongLyricLine) => void
  onSeekToChantEvent?: (event: SongChantEvent) => void
  onSelectEditLine?: (line: SongLyricLine) => void
  onUpdateChantText?: UpdateChantText
  onDeleteChantNote?: DeleteChantNote
  onAddChantNote?: AddChantNote
  onSaveChantEvents?: SaveChantEvents
}

export function LyricsPanel({
  lyrics,
  chantEvents = [],
  activeLineId,
  activeChantEventId,
  selectedEditLineId,
  showTranslation,
  hasTranslation,
  showChantRomanization,
  autoScroll,
  isEditing = false,
  onToggleTranslation,
  onToggleChantRomanization,
  onToggleAutoScroll,
  onToggleEditing,
  onSeekToLine,
  onSeekToChantEvent,
  onSelectEditLine,
  onUpdateChantText,
  onDeleteChantNote,
  onAddChantNote,
  onSaveChantEvents,
}: LyricsPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const activeRef = useRef<HTMLDivElement | null>(null)
  const isSelectingRef = useRef(false)
  const activeLyricSelectionRef = useRef<ActiveLyricSelection | null>(null)
  const [editingChantKey, setEditingChantKey] = useState<string | null>(null)
  const [lyricSelection, setLyricSelection] = useState<LyricSelection | null>(null)
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopover | null>(null)
  const [pendingChant, setPendingChant] = useState<PendingChant | null>(null)
  const [pendingChantEvent, setPendingChantEvent] = useState<PendingChantEvent | null>(null)
  const [editingChantEvent, setEditingChantEvent] = useState<EditingChantEvent | null>(null)

  useEffect(() => {
    if (!autoScroll || !listRef.current || !activeRef.current) {
      return
    }

    const list = listRef.current
    const activeLine = activeRef.current
    const nextTop = activeLine.offsetTop - list.clientHeight / 2 + activeLine.clientHeight / 2

    list.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [activeLineId, activeChantEventId, autoScroll])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    function clearClearedSelection() {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setLyricSelection(null)
        setSelectionPopover(null)
      }
    }

    document.addEventListener('selectionchange', clearClearedSelection)
    return () => document.removeEventListener('selectionchange', clearClearedSelection)
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    function finishSelection(event: globalThis.PointerEvent) {
      const activeSelection = activeLyricSelectionRef.current
      if (!isSelectingRef.current || !activeSelection) {
        return
      }

      isSelectingRef.current = false
      activeLyricSelectionRef.current = null
      handleLyricTextPointerUp(activeSelection.line, activeSelection.container, event.clientX, event.clientY, cardRef.current, setLyricSelection, setSelectionPopover, setPendingChant)
    }

    document.addEventListener('pointerup', finishSelection)
    return () => document.removeEventListener('pointerup', finishSelection)
  }, [isEditing])

  function toggleEditing() {
    if (isEditing) {
      setEditingChantKey(null)
      setLyricSelection(null)
      setSelectionPopover(null)
      setPendingChant(null)
      setPendingChantEvent(null)
      setEditingChantEvent(null)
    }
    onToggleEditing?.()
  }

  const selectedLine = lyricSelection ? lyrics.find((line) => line.id === lyricSelection.lineId) : null
  const canShowTranslation = showTranslation && hasTranslation
  const timelineItems = buildTimelineItems(lyrics, chantEvents)

  return (
    <section ref={cardRef} className="lyrics-card">
      <div className="player-topline">
        <div>
          <h2>Lyrics flow</h2>
        </div>
        <div className="mode-bar">
          <button
            type="button"
            className={`chip-button chip-button--compact${canShowTranslation ? ' is-active' : ''}`}
            onClick={onToggleTranslation}
            disabled={!hasTranslation}
          >
            Translation {canShowTranslation ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className={`chip-button chip-button--compact${showChantRomanization ? ' is-active' : ''}`}
            onClick={onToggleChantRomanization}
          >
            Romanization {showChantRomanization ? 'on' : 'off'}
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
            onClick={toggleEditing}
          >
            {isEditing ? 'Done editing' : 'Edit lyrics'}
          </button>
        </div>
      </div>

      <div ref={listRef} className="lyrics-list">
        {isEditing && onSaveChantEvents ? renderChantEventEditor('intro', lyrics, chantEvents, pendingChantEvent, setPendingChantEvent, onSaveChantEvents) : null}
        {timelineItems.map((item) => {
          if (item.type === 'chant') {
            const isActive = item.event.id === activeChantEventId

            return (
              <div
                key={`chant-${item.event.id}`}
                ref={isActive ? activeRef : null}
                role="button"
                tabIndex={0}
                className={`lyric-line lyric-line--chant-event${isActive ? ' lyric-line--active' : ''}${isEditing ? ' lyric-line--editing' : ''}`}
                onClick={() => {
                  if (!isEditing) {
                    onSeekToChantEvent?.(item.event)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()
                  if (!isEditing) {
                    onSeekToChantEvent?.(item.event)
                  }
                }}
              >
                {isEditing && onSaveChantEvents ? renderExistingChantEventEditor(item.event, chantEvents, editingChantEvent, setEditingChantEvent, onSaveChantEvents) : (
                  <>
                    <span className="lyric-line__time">
                      {formatTime(item.event.start)} - {formatTime(item.event.end)}
                    </span>
                    <span className="lyric-line__text lyric-line__text--chant-event">
                      <span className="badge badge--compact badge--ready">{item.event.label}</span>
                      <span>{item.event.text}</span>
                    </span>
                    {showChantRomanization && item.event.romanizedText ? (
                      <span className="lyric-line__translation">{item.event.romanizedText}</span>
                    ) : null}
                  </>
                )}
              </div>
            )
          }

          const line = item.line
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
                onPointerDown={(event) => {
                  isSelectingRef.current = true
                  activeLyricSelectionRef.current = { line, container: event.currentTarget }
                  setSelectionPopover(null)
                }}
                onMouseMove={(event) => {
                  if (!isEditing) {
                    return
                  }

                  event.currentTarget.style.cursor = isPointNearLyricText(event.currentTarget, event.clientX, event.clientY) ? 'text' : 'default'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.cursor = ''
                }}
                onPointerUp={(event) => {
                  if (!isEditing) {
                    return
                  }

                  isSelectingRef.current = false
                  activeLyricSelectionRef.current = null
                  handleLyricTextMouseUp(line, event, cardRef.current, setLyricSelection, setSelectionPopover, setPendingChant)
                }}
              >
                {renderLyricText(
                  line,
                  isEditing,
                  editingChantKey,
                  setEditingChantKey,
                  onUpdateChantText,
                  onDeleteChantNote,
                  pendingChant?.lineId === line.id ? pendingChant : null,
                  setPendingChant,
                  onAddChantNote,
                  showChantRomanization,
                )}
              </span>
              {canShowTranslation && line.translation ? (
                <span className="lyric-line__translation">{line.translation}</span>
              ) : null}
            </div>
          )
        })}
        {isEditing && onSaveChantEvents ? renderChantEventEditor('outro', lyrics, chantEvents, pendingChantEvent, setPendingChantEvent, onSaveChantEvents) : null}
      </div>
      {isEditing && selectedLine && lyricSelection && selectionPopover ? (
        <div
          className="chant-selection-popover"
          style={{ left: selectionPopover.x, top: selectionPopover.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="chip-button chip-button--compact" onClick={() => addSelectedChant(selectedLine, lyricSelection, 'inline', onAddChantNote, setLyricSelection, setSelectionPopover)}>
            Inline
          </button>
          <button type="button" className="chip-button chip-button--compact" onClick={() => startPendingChant(lyricSelection, 'replace-phrase', setPendingChant, setLyricSelection, setSelectionPopover)}>
            Simultaneous
          </button>
        </div>
      ) : null}
    </section>
  )
}

type TimelineItem =
  | { type: 'lyric'; line: SongLyricLine }
  | { type: 'chant'; event: SongChantEvent }

function buildTimelineItems(lyrics: SongLyricLine[], chantEvents: SongChantEvent[]): TimelineItem[] {
  return [
    ...lyrics.map((line) => ({ type: 'lyric' as const, line })),
    ...chantEvents.map((event) => ({ type: 'chant' as const, event })),
  ].sort((left, right) => {
    const leftStart = left.type === 'lyric' ? left.line.start : left.event.start
    const rightStart = right.type === 'lyric' ? right.line.start : right.event.start

    return leftStart - rightStart
  })
}

function renderChantEventEditor(
  position: 'intro' | 'outro',
  lyrics: SongLyricLine[],
  chantEvents: SongChantEvent[],
  pendingChantEvent: PendingChantEvent | null,
  setPendingChantEvent: (value: PendingChantEvent | null) => void,
  onSaveChantEvents: SaveChantEvents,
) {
  const isOpen = pendingChantEvent?.position === position
  const defaults = getChantEventDefaults(position, lyrics)

  if (!isOpen) {
    return (
      <button
        type="button"
        className="chant-event-add"
        onClick={() => setPendingChantEvent({ position, start: defaults.start, end: defaults.end, text: '' })}
      >
        + Add {position} chant
      </button>
    )
  }

  const start = parseDraftTime(pendingChantEvent.start)
  const end = parseDraftTime(pendingChantEvent.end)
  const canSave = Number.isFinite(start) && Number.isFinite(end) && end > start && pendingChantEvent.text.trim().length > 0

  return (
    <div className="chant-event-editor">
      <input
        className="field"
        value={pendingChantEvent.start}
        placeholder="00:00"
        aria-label={`${position} chant start`}
        onChange={(event) => setPendingChantEvent({ ...pendingChantEvent, start: event.target.value })}
      />
      <input
        className="field"
        value={pendingChantEvent.end}
        placeholder="00:05"
        aria-label={`${position} chant end`}
        onChange={(event) => setPendingChantEvent({ ...pendingChantEvent, end: event.target.value })}
      />
      <input
        className="field"
        value={pendingChantEvent.text}
        placeholder="Chant text"
        aria-label={`${position} chant text`}
        onChange={(event) => setPendingChantEvent({ ...pendingChantEvent, text: event.target.value })}
      />
      <button
        type="button"
        className="chip-button chip-button--compact"
        disabled={!canSave}
        onClick={() => {
          if (!canSave) {
            return
          }

          onSaveChantEvents([...chantEvents, {
            id: `chant_${Date.now().toString(36)}`,
            start,
            end,
            text: pendingChantEvent.text.trim(),
            label: 'chant',
          }])
          setPendingChantEvent(null)
        }}
      >
        Save
      </button>
      <button type="button" className="ghost-button player-calibration__small-button" onClick={() => setPendingChantEvent(null)}>
        Cancel
      </button>
    </div>
  )
}

function renderExistingChantEventEditor(
  event: SongChantEvent,
  chantEvents: SongChantEvent[],
  editingChantEvent: EditingChantEvent | null,
  setEditingChantEvent: (value: EditingChantEvent | null) => void,
  onSaveChantEvents: SaveChantEvents,
) {
  const draft = editingChantEvent?.id === event.id ? editingChantEvent : {
    id: event.id,
    start: formatDraftSeconds(event.start),
    end: formatDraftSeconds(event.end),
    text: event.text,
  }
  const start = parseDraftTime(draft.start)
  const end = parseDraftTime(draft.end)
  const canSave = Number.isFinite(start) && Number.isFinite(end) && end > start && draft.text.trim().length > 0
  const commitDraft = () => {
    if (!canSave) {
      return
    }

    onSaveChantEvents(chantEvents.map((item) => (
      item.id === event.id ? { ...item, start, end, text: draft.text.trim() } : item
    )))
    setEditingChantEvent(null)
  }

  return (
    <div
      className="chant-event-editor chant-event-editor--existing"
      onClick={(clickEvent) => clickEvent.stopPropagation()}
      onBlur={(blurEvent) => {
        if (!(blurEvent.relatedTarget instanceof Node) || !blurEvent.currentTarget.contains(blurEvent.relatedTarget)) {
          commitDraft()
        }
      }}
    >
      <input
        className="field"
        value={draft.start}
        placeholder="00:00"
        aria-label="Chant start"
        onFocus={() => setEditingChantEvent(draft)}
        onChange={(changeEvent) => setEditingChantEvent({ ...draft, start: changeEvent.target.value })}
      />
      <input
        className="field"
        value={draft.end}
        placeholder="00:05"
        aria-label="Chant end"
        onFocus={() => setEditingChantEvent(draft)}
        onChange={(changeEvent) => setEditingChantEvent({ ...draft, end: changeEvent.target.value })}
      />
      <input
        className="field"
        value={draft.text}
        aria-label="Chant text"
        onFocus={() => setEditingChantEvent(draft)}
        onChange={(changeEvent) => setEditingChantEvent({ ...draft, text: changeEvent.target.value })}
      />
      <button
        type="button"
        className="ghost-button player-calibration__small-button chant-event-delete"
        onClick={() => {
          if (window.confirm(`Remove ${event.text} from the chant timeline?`)) {
            onSaveChantEvents(chantEvents.filter((item) => item.id !== event.id))
            setEditingChantEvent(null)
          }
        }}
      >
        Remove
      </button>
    </div>
  )
}

function getChantEventDefaults(position: 'intro' | 'outro', lyrics: SongLyricLine[]) {
  const firstLine = lyrics[0]
  const lastLine = lyrics[lyrics.length - 1]

  if (position === 'intro') {
    const end = Math.max(0, firstLine?.start ?? 5)
    return { start: '0', end: formatDraftSeconds(end || 5) }
  }

  const start = lastLine?.end ?? 0
  return { start: formatDraftSeconds(start), end: formatDraftSeconds(start + 5) }
}

function formatDraftSeconds(value: number) {
  return formatTime(value)
}

function parseDraftTime(value: string) {
  const parts = value.trim().split(':')

  if (parts.length === 1) {
    const seconds = Number(parts[0])
    return Number.isFinite(seconds) ? Math.round(seconds) : Number.NaN
  }

  if (parts.length !== 2) {
    return Number.NaN
  }

  const minutes = Number(parts[0])
  const seconds = Number(parts[1])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
    return Number.NaN
  }

  return Math.round(minutes) * 60 + Math.round(seconds)
}

function renderLyricText(
  line: SongLyricLine,
  isEditing: boolean,
  editingChantKey: string | null,
  setEditingChantKey: (value: string | null) => void,
  onUpdateChantText?: UpdateChantText,
  onDeleteChantNote?: DeleteChantNote,
  pendingChant?: PendingChant | null,
  setPendingChant?: (value: PendingChant | null) => void,
  onAddChantNote?: AddChantNote,
  showChantRomanization = true,
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
        {note.placement === 'insert-at' ? null : note.placement === 'inline' && isEditing ? (
          <span className="chant-anchor-wrap">
            <span className="chant-annotated">
              <span className="chant-anchor">{matchedText}</span>
              {showChantRomanization && note.romanizedText ? (
                <span className="chant-romanization chant-romanization--inline">{note.romanizedText}</span>
              ) : null}
            </span>
            <button
              type="button"
              className="chant-pill-delete"
              aria-label="Delete inline fanchant"
              onMouseDown={stopChantDeletePointerEvent}
              onMouseUp={stopChantDeletePointerEvent}
              onClick={(event) => {
                event.stopPropagation()
                setEditingChantKey(null)
                onDeleteChantNote?.(line, noteIndex)
              }}
            >
              ×
            </button>
          </span>
        ) : (
          <span className="chant-annotated">
            <span className={note.placement === 'replace-phrase' ? 'chant-anchor chant-anchor--replace' : 'chant-anchor'}>{matchedText}</span>
            {note.placement === 'inline' && showChantRomanization && note.romanizedText ? (
              <span className="chant-romanization chant-romanization--inline">{note.romanizedText}</span>
            ) : null}
          </span>
        )}
        {isPending && pendingChant && setPendingChant && onAddChantNote ? (
          renderPendingChantInput(line, pendingChant, setPendingChant, onAddChantNote)
        ) : note.placement === 'insert-at' ? (
          renderEditableChantText(line, note, noteIndex, isEditing, editingChantKey, setEditingChantKey, onUpdateChantText, onDeleteChantNote, true, showChantRomanization)
        ) : note.placement === 'replace-phrase' ? (
          renderEditableChantText(line, note, noteIndex, isEditing, editingChantKey, setEditingChantKey, onUpdateChantText, onDeleteChantNote, true, showChantRomanization)
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
  event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
  popoverContainer: HTMLElement | null,
  setLyricSelection: (value: LyricSelection | null) => void,
  setSelectionPopover: (value: SelectionPopover | null) => void,
  setPendingChant: (value: PendingChant | null) => void,
) {
  if (event.target instanceof HTMLElement && event.target.closest('.chant-pill, .chant-edit-field')) {
    return
  }

  handleLyricTextPointerUp(line, event.currentTarget, event.clientX, event.clientY, popoverContainer, setLyricSelection, setSelectionPopover, setPendingChant)
}

function handleLyricTextPointerUp(
  line: SongLyricLine,
  lyricTextElement: HTMLElement,
  clientX: number,
  clientY: number,
  popoverContainer: HTMLElement | null,
  setLyricSelection: (value: LyricSelection | null) => void,
  setSelectionPopover: (value: SelectionPopover | null) => void,
  setPendingChant: (value: PendingChant | null) => void,
) {
  const selection = readLyricSelection(line, lyricTextElement)
  if (selection) {
    flushSync(() => {
      setPendingChant(null)
      setLyricSelection(selection)
      setSelectionPopover(readSelectionPopover(line.id, clientX, clientY, popoverContainer))
    })
    return
  }

  const insertOffset = getClickLyricTextOffset(lyricTextElement, clientX, clientY)
  if (insertOffset === null) {
    setLyricSelection(null)
    setSelectionPopover(null)
    return
  }

  setLyricSelection(null)
  setSelectionPopover(null)
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

function readSelectionPopover(lineId: string, clientX: number, clientY: number, container: HTMLElement | null): SelectionPopover | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !container) {
    return null
  }

  const range = selection.getRangeAt(0)
  const rects = Array.from(range.getClientRects())
  const selectedRect = rects.find((rect) => (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )) ?? rects.at(-1)
  if (!selectedRect || (selectedRect.width === 0 && selectedRect.height === 0)) {
    return null
  }

  const containerRect = container.getBoundingClientRect()

  return {
    lineId,
    x: selectedRect.left + selectedRect.width / 2 - containerRect.left,
    y: selectedRect.bottom - containerRect.top + 8,
  }
}

function getLyricTextOffset(container: HTMLElement, target: Node, targetOffset: number) {
  let offset = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const node = walker.currentNode
    const element = node.parentElement

    if (element?.closest('.chant-pill, .chant-edit-field, .chant-pill-delete, .chant-romanization')) {
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
  if (!isPointNearLyricText(container, clientX, clientY)) {
    return null
  }

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

function isPointNearLyricText(container: HTMLElement, clientX: number, clientY: number) {
  const padding = 28
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const node = walker.currentNode
    const element = node.parentElement
    if (element?.closest('.chant-pill, .chant-edit-field, .chant-pill-delete, .chant-romanization')) {
      continue
    }

    const range = document.createRange()
    range.selectNodeContents(node)
    const isNearText = Array.from(range.getClientRects()).some((rect) => (
      clientY >= rect.top - padding &&
      clientY <= rect.bottom + padding &&
      clientX >= rect.left - padding &&
      clientX <= rect.right + padding
    ))
    range.detach()

    if (isNearText) {
      return true
    }
  }

  return false
}

function addSelectedChant(
  line: SongLyricLine,
  selection: LyricSelection,
  placement: 'inline',
  onAddChantNote: AddChantNote | undefined,
  setLyricSelection: (value: LyricSelection | null) => void,
  setSelectionPopover: (value: SelectionPopover | null) => void,
) {
  if (!onAddChantNote) {
    return
  }

  onAddChantNote(line, buildChantNote(line, selection, placement, selection.text))
  window.getSelection()?.removeAllRanges()
  setLyricSelection(null)
  setSelectionPopover(null)
}

function startPendingChant(
  selection: LyricSelection,
  placement: 'replace-phrase',
  setPendingChant: (value: PendingChant | null) => void,
  setLyricSelection: (value: LyricSelection | null) => void,
  setSelectionPopover: (value: SelectionPopover | null) => void,
) {
  setPendingChant({
    lineId: selection.lineId,
    selection,
    placement,
    text: '',
  })
  window.getSelection()?.removeAllRanges()
  setLyricSelection(null)
  setSelectionPopover(null)
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
        placeholder="fanchant"
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
  onDeleteChantNote: DeleteChantNote | undefined,
  isInline: boolean,
  showChantRomanization: boolean,
) {
  const chantKey = `${line.id}:${noteIndex}`
  const isEditingThisChant = editingChantKey === chantKey

  if (isEditing && isEditingThisChant) {
    const finishEditing = () => {
      setEditingChantKey(null)
      if (!note.text.trim() && (note.placement === 'insert-at' || note.placement === 'replace-phrase')) {
        onDeleteChantNote?.(line, noteIndex)
      }
    }

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
          onBlur={finishEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.currentTarget.blur()
            }
          }}
        />
      </label>
    )
  }

  const canDeleteDirectly = isEditing && (note.placement === 'insert-at' || note.placement === 'replace-phrase')

  return (
    <span className="chant-pill-wrap">
      <button
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
        <span className="chant-pill__text">{note.text}</span>
        {showChantRomanization && note.romanizedText ? (
          <span className="chant-romanization">{note.romanizedText}</span>
        ) : null}
      </button>
      {canDeleteDirectly ? (
        <button
          type="button"
          className="chant-pill-delete"
          aria-label="Delete fanchant"
          onMouseDown={stopChantDeletePointerEvent}
          onMouseUp={stopChantDeletePointerEvent}
          onClick={(event) => {
            event.stopPropagation()
            setEditingChantKey(null)
            onDeleteChantNote?.(line, noteIndex)
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  )
}

function stopChantDeletePointerEvent(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault()
  event.stopPropagation()
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
    (candidate.romanizedText === undefined || typeof candidate.romanizedText === 'string') &&
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
