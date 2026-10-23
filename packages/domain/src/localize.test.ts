import { ACTION_LABEL, TRIGGER_LABEL } from './automation';
import { DUE_BUCKET_LABEL, formatDueDate } from './dates';
import { FIELD_KIND_LABEL } from './fields';
import { IMPORT_TARGET_LABEL, parsePriority } from './import';
import { localizeDomain, type DomainTexts } from './localize';
import { PROJECT_HEALTH_LABEL } from './model';
import { PRIORITY_LABEL } from './priority';
import { WEEKDAY_SHORT } from './recurrence';
import { STATUS_CATEGORY_LABEL } from './status';
import { words } from './text';
import { WEBHOOK_EVENT_LABEL } from './webhooks';

const today = '2026-10-22';

describe('localizeDomain', () => {
  it('switches labels and words in place, and back', () => {
    const english: DomainTexts = {
      ...words,
      priority: { ...PRIORITY_LABEL },
      statusCategory: { ...STATUS_CATEGORY_LABEL },
      projectHealth: { ...PROJECT_HEALTH_LABEL },
      dueBucket: { ...DUE_BUCKET_LABEL },
      fieldKind: { ...FIELD_KIND_LABEL },
      trigger: { ...TRIGGER_LABEL },
      action: { ...ACTION_LABEL },
      webhookEvent: { ...WEBHOOK_EVENT_LABEL },
      importTarget: { ...IMPORT_TARGET_LABEL },
    };

    localizeDomain(
      { ...english, priority: { ...english.priority, 1: 'Urgente' }, today: 'Oggi' },
      'it',
    );
    expect(PRIORITY_LABEL[1]).toBe('Urgente');
    expect(formatDueDate(today, today)).toBe('Oggi');
    expect(formatDueDate('2026-11-30', today)).toBe('30 nov');
    expect(WEEKDAY_SHORT[1]).toBe('lun');
    // CSV imports keep reading English priorities.
    expect(['Urgente', 'Urgent'].map(parsePriority)).toEqual([1, 1]);

    localizeDomain(english, 'en');
    expect(PRIORITY_LABEL[1]).toBe('Urgent');
    expect(formatDueDate(today, today)).toBe('Today');
    expect(WEEKDAY_SHORT[1]).toBe('Mon');
  });
});
