import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Check, Link2, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isMissingTable } from '../data/api'
import {
  deleteNote,
  linkColumns,
  linkOf,
  linkValue,
  parseLinkValue,
  sameLink,
  saveNote,
  sortNotes,
  useNotes,
  type NoteLink,
  type NoteRow,
} from '../data/notes'
import { useNoteTargets } from './noteTargets'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { TEXT, useUrlState } from '../lib/urlState'
import { useConfirm } from './confirm'
import { DbUpdateNotice } from './DbUpdateNotice'
import { Button, ErrorText } from './form'
import { Card } from './ui'

const field = 'min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/**
 * Notes of the current career: quick add, filter by category, search, pin, done, edit, and
 * a link to a player, staff member or match. With `scope`, only the notes linked to that one
 * (on its own page), and new notes get the link.
 */
export function NotesPanel({ limit, scope }: { limit?: number; scope?: NoteLink }) {
  const career = useCurrentCareer()
  const { noteCategories } = useConfig()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data, error, isPending } = useNotes(career.id)
  const [category, setCategory] = useUrlState('notes', 'all', TEXT)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [draftCategory, setDraftCategory] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [draftLink, setDraftLink] = useState('')
  const [editLink, setEditLink] = useState('')
  const targets = useNoteTargets()

  const done = () => qc.invalidateQueries({ queryKey: ['notes', career.id] })
  const save = useMutation({
    mutationFn: (v: { id: string | null; patch: Parameters<typeof saveNote>[2] }) =>
      saveNote(career.id, v.id, v.patch),
    onSuccess: done,
  })
  const remove = useMutation({ mutationFn: deleteNote, onSuccess: done })

  if (error && isMissingTable(error)) return <DbUpdateNotice update="0008" />

  const catOf = (id: string | null) => noteCategories.find((c) => c.id === id)
  const q = query.trim().toLowerCase()
  const mine = (data ?? []).filter((n) => !scope || sameLink(linkOf(n), scope))
  const notes = sortNotes(mine).filter(
    (n) =>
      (scope || category === 'all' || n.category === category) &&
      (!q ||
        n.body.toLowerCase().includes(q) ||
        (catOf(n.category)?.name ?? '').toLowerCase().includes(q)),
  )
  const shown = limit ? notes.slice(0, limit) : notes
  const count = (id: string) => mine.filter((n) => n.category === id && !n.done).length

  const add = () => {
    // A note needs text and a category
    if (!draft.trim() || !draftCategory) return
    save.mutate(
      {
        id: null,
        patch: {
          body: draft.trim(),
          category: draftCategory,
          ...linkColumns(scope ?? parseLinkValue(draftLink)),
        },
      },
      { onSuccess: () => (setDraft(''), setDraftLink('')) },
    )
  }

  return (
    <Card>
      <div
        className={clsx(
          'mb-3 flex items-center justify-between gap-2',
          !limit && !scope && 'hidden',
        )}
      >
        <h2 className="font-semibold">Notes</h2>
        {limit && !scope && (data?.length ?? 0) > 0 && (
          <Link to="/notes" className="text-sm font-semibold text-accent">
            See all ({data!.length})
          </Link>
        )}
      </div>

      {/* Quick add */}
      <form
        className={clsx(
          'grid gap-2',
          scope ? 'sm:grid-cols-[12rem_1fr_auto]' : 'sm:grid-cols-[11rem_14rem_1fr_auto]',
        )}
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <select
          aria-label="Category of the new note"
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value)}
          className={field}
        >
          <option value="" disabled>
            Select category…
          </option>
          {noteCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {!scope && (
          <LinkSelect
            label="Link the new note to"
            value={draftLink}
            onChange={setDraftLink}
            targets={targets}
          />
        )}
        <textarea
          aria-label="New note"
          placeholder="Write a note…"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds, Shift+Enter makes a new line
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              add()
            }
          }}
          className={`${field} min-w-0 resize-y py-2`}
        />
        <Button type="submit" disabled={!draft.trim() || !draftCategory || save.isPending}>
          Add
        </Button>
      </form>
      {draft.trim() && !draftCategory && (
        <p className="mt-1 text-xs text-amber-300">Select a category to add the note.</p>
      )}
      <ErrorText
        error={save.error ?? remove.error ?? (error && !isMissingTable(error) ? error : null)}
      />

      {/* Filters */}
      <div className={scope ? 'hidden' : 'mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center'}>
        {/* Phones: one row that scrolls sideways; wider screens wrap */}
        <div className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 sm:contents [&::-webkit-scrollbar]:hidden">
          {[{ id: 'all', name: 'All', color: '' }, ...noteCategories].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={clsx(
                'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap',
                category === c.id
                  ? 'border-accent bg-accent/15 font-semibold text-text'
                  : 'border-border text-muted hover:text-text',
              )}
            >
              {c.color && (
                <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
              )}
              {c.name}
              {c.id !== 'all' && count(c.id) > 0 && (
                <span className="text-xs text-muted tabular-nums">{count(c.id)}</span>
              )}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Search notes"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${field} w-full sm:ml-auto sm:w-48`}
        />
      </div>

      {/* List */}
      {isPending ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {mine.length ? 'No notes match.' : 'No notes yet. Write the first one above.'}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {shown.map((n: NoteRow) => {
            const cat = catOf(n.category)
            const isEditing = editing === n.id
            return (
              <li
                key={n.id}
                className={clsx(
                  'rounded-lg border border-border bg-surface-2/40 p-3',
                  n.pinned && 'border-accent/40',
                  n.done && 'opacity-60',
                )}
              >
                {isEditing ? (
                  <div className="grid gap-2">
                    <select
                      aria-label="Category"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className={`${field} sm:w-56`}
                    >
                      <option value="" disabled>
                        Select category…
                      </option>
                      {noteCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {!scope && (
                      <LinkSelect
                        label="Linked to"
                        value={editLink}
                        onChange={setEditLink}
                        targets={targets}
                      />
                    )}
                    <textarea
                      aria-label="Note"
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className={`${field} py-2`}
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={!editCategory}
                        onClick={() =>
                          save.mutate(
                            {
                              id: n.id,
                              patch: {
                                body: editText.trim() || n.body,
                                category: editCategory,
                                ...(scope ? {} : linkColumns(parseLinkValue(editLink))),
                              },
                            },
                            { onSuccess: () => setEditing(null) },
                          )
                        }
                      >
                        Save
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-label={n.done ? 'Mark as not done' : 'Mark as done'}
                      onClick={() => save.mutate({ id: n.id, patch: { done: !n.done } })}
                      className={clsx(
                        'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border',
                        n.done
                          ? 'border-accent bg-accent text-bg'
                          : 'border-border hover:border-accent',
                      )}
                    >
                      {n.done && <Check className="size-4" aria-hidden />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={clsx(
                          'text-sm break-words whitespace-pre-wrap',
                          n.done && 'line-through',
                        )}
                      >
                        {n.body}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {cat && (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: cat.color }}
                              aria-hidden
                            />
                            {cat.name}
                          </span>
                        )}
                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                        {!scope &&
                          (() => {
                            const link = linkOf(n)
                            if (!link) return null
                            const t = targets.describe(link)
                            return (
                              <Link
                                to={t.href}
                                className="inline-flex max-w-full items-center gap-1 truncate rounded bg-surface px-1.5 text-accent hover:underline"
                              >
                                <Link2 className="size-3 shrink-0" aria-hidden />
                                {t.label}
                              </Link>
                            )
                          })()}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        aria-label={n.pinned ? 'Unpin' : 'Pin'}
                        onClick={() => save.mutate({ id: n.id, patch: { pinned: !n.pinned } })}
                        className={clsx(
                          'grid size-9 place-items-center rounded-lg hover:bg-surface-2',
                          n.pinned ? 'text-accent' : 'text-muted',
                        )}
                      >
                        {n.pinned ? (
                          <PinOff className="size-4" aria-hidden />
                        ) : (
                          <Pin className="size-4" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => {
                          setEditing(n.id)
                          setEditText(n.body)
                          setEditCategory(n.category ?? '')
                          setEditLink(linkValue(linkOf(n)))
                        }}
                        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: 'Delete this note?',
                              message: n.body.slice(0, 120),
                              confirmLabel: 'Delete',
                              danger: true,
                            })
                          )
                            remove.mutate(n.id)
                        }}
                        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {limit && notes.length > limit && (
        <Link
          to="/notes"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent"
        >
          {notes.length - limit} more notes →
        </Link>
      )}
    </Card>
  )
}

/** Picker for what a note is linked to: a player, a staff member or one of your matches. */
function LinkSelect({
  label,
  value,
  onChange,
  targets,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  targets: ReturnType<typeof useNoteTargets>
}) {
  const groups: [string, typeof targets.players][] = [
    ['Players', targets.players],
    ['Staff', targets.staff],
    ['Matches', targets.matches],
  ]
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${field} min-w-0`}
    >
      <option value="">Not linked</option>
      {groups.map(([name, list]) =>
        list.length ? (
          <optgroup key={name} label={name}>
            {list.map((t) => (
              <option key={linkValue(t.link)} value={linkValue(t.link)}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  )
}
