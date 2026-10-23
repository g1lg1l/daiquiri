import type { RichDocument } from './model';
import { isPriority, PRIORITY_LABEL, type Priority } from './priority';

/** Plain text → editor document; one paragraph per line. */
export function textToDocument(text: string): RichDocument | null {
  if (!text.trim()) return null;
  return {
    type: 'doc',
    content: text
      .split(/\r?\n/)
      .map((line) =>
        line
          ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
          : { type: 'paragraph' },
      ),
  };
}

/**
 * RFC 4180 CSV: quoted fields with doubled quotes and line breaks, CRLF or LF,
 * a leading byte-order mark, and a semicolon separator when the header uses
 * one (spreadsheets in many locales). Empty trailing lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, '');
  const firstLine = input.slice(0, input.search(/\r?\n|$/));
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export const IMPORT_TARGETS = [
  'title',
  'description',
  'status',
  'priority',
  'assignee',
  'labels',
  'project',
  'dueDate',
  'startDate',
  'estimate',
] as const;
export type ImportTarget = (typeof IMPORT_TARGETS)[number];

export const IMPORT_TARGET_LABEL: Record<ImportTarget, string> = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  labels: 'Labels',
  project: 'Project',
  dueDate: 'Due date',
  startDate: 'Start date',
  estimate: 'Estimate',
};

// Header names used by Linear, Asana, ClickUp, Jira and spreadsheets.
const HEADER_NAMES: Record<ImportTarget, string[]> = {
  title: ['title', 'name', 'task name', 'task', 'summary', 'subject'],
  description: ['description', 'notes', 'details', 'content', 'task content'],
  status: ['status', 'state', 'section/column', 'section', 'column'],
  priority: ['priority'],
  assignee: ['assignee', 'assigned to', 'assignees', 'owner'],
  labels: ['labels', 'label', 'tags', 'tag'],
  project: ['project', 'projects', 'list', 'list name'],
  dueDate: ['due date', 'due', 'due on', 'due_date', 'deadline'],
  startDate: ['start date', 'start', 'start on', 'start_date'],
  estimate: ['estimate', 'points', 'story points', 'time estimate'],
};

/** Column index for each target the headers recognisably match. */
export function guessMapping(headers: readonly string[]): Partial<Record<ImportTarget, number>> {
  const normal = headers.map((h) => h.trim().toLowerCase());
  const mapping: Partial<Record<ImportTarget, number>> = {};
  const used = new Set<number>();
  for (const target of IMPORT_TARGETS) {
    const index = normal.findIndex((h, i) => !used.has(i) && HEADER_NAMES[target].includes(h));
    if (index >= 0) {
      mapping[target] = index;
      used.add(index);
    }
  }
  return mapping;
}

const PRIORITY_WORDS: Record<string, Priority> = {
  urgent: 1,
  critical: 1,
  highest: 1,
  high: 2,
  medium: 3,
  normal: 3,
  low: 4,
  lowest: 4,
  none: 0,
  'no priority': 0,
};

/** "Urgent", "High", "P2", "2", "Medium"… → Priority; unknown → 0. */
export function parsePriority(cell: string): Priority {
  const text = cell.trim().toLowerCase();
  const known = PRIORITY_WORDS[text];
  if (known !== undefined) return known;
  const number = Number(text.replace(/^p/, ''));
  if (text && isPriority(number)) return number;
  const label = Object.entries(PRIORITY_LABEL).find(([, name]) => name.toLowerCase() === text);
  const fromLabel = Number(label?.[0]);
  return isPriority(fromLabel) ? fromLabel : 0;
}

/** ISO dates and timestamps, or anything Date.parse reads unambiguously; else null. */
export function parseDateCell(cell: string): string | null {
  const text = cell.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // 01/02/2026 could be January 2 or February 1: refuse rather than guess.
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(text)) return null;
  const time = Date.parse(text);
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "a, b; c" → ["a", "b", "c"], for labels and several assignees in one cell. */
export const splitList = (cell: string): string[] =>
  cell
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
