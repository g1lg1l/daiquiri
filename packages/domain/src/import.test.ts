import {
  guessMapping,
  parseCsv,
  parseDateCell,
  parsePriority,
  splitList,
  textToDocument,
} from './import';

describe('csv import', () => {
  it('parses quoted fields, line breaks, CRLF and a BOM', () => {
    const csv = '﻿Title,Description\r\n"Fix ""login""","Line one\nLine two"\r\nPlain,\r\n\r\n';
    expect(parseCsv(csv)).toEqual([
      ['Title', 'Description'],
      ['Fix "login"', 'Line one\nLine two'],
      ['Plain', ''],
    ]);
  });

  it('reads semicolon-separated files', () => {
    expect(parseCsv('Name;Due date\nShip;2026-10-30')).toEqual([
      ['Name', 'Due date'],
      ['Ship', '2026-10-30'],
    ]);
  });

  it('maps the headers of common exports', () => {
    expect(
      guessMapping(['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Labels', 'Due Date']),
    ).toEqual({
      title: 1,
      status: 2,
      priority: 3,
      assignee: 4,
      labels: 5,
      dueDate: 6,
    });
    // Asana: "Name", "Notes", "Section/Column", "Due Date", "Tags".
    expect(
      guessMapping(['Task ID', 'Name', 'Notes', 'Section/Column', 'Due Date', 'Tags']),
    ).toMatchObject({
      title: 1,
      description: 2,
      status: 3,
      dueDate: 4,
      labels: 5,
    });
  });

  it('reads priorities, dates and lists', () => {
    expect(['Urgent', 'high', 'P3', '4', 'No priority', 'whatever'].map(parsePriority)).toEqual([
      1, 2, 3, 4, 0, 0,
    ]);
    expect(parseDateCell('2026-10-23T14:00:00.000Z')).toBe('2026-10-23');
    expect(parseDateCell('Oct 30, 2026')).toBe('2026-10-30');
    expect(parseDateCell('01/02/2026')).toBeNull();
    expect(parseDateCell('')).toBeNull();
    expect(splitList('Bug, Infra; UI')).toEqual(['Bug', 'Infra', 'UI']);
  });

  it('turns text into paragraphs', () => {
    expect(textToDocument('a\n\nb')?.content).toHaveLength(3);
    expect(textToDocument('  ')).toBeNull();
  });
});
