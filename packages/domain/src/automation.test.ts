import { automationInputSchema, emptyAction } from './automation';

const id = '6f1c1b9e-5b0e-4a37-9d2f-6a3b1b2c3d4e';

describe('automation schemas', () => {
  it('accepts a sentence of trigger, conditions and actions', () => {
    const parsed = automationInputSchema.safeParse({
      name: ' Triage urgent ',
      trigger: { kind: 'status_changed', category: 'started' },
      conditions: { priorities: [1], assignee: 'none' },
      actions: [{ kind: 'assign', user_id: id }, { kind: 'unassign' }],
    });
    expect(parsed.success && parsed.data.name).toBe('Triage urgent');
  });

  it('rejects incomplete or too many actions', () => {
    const base = { name: 'Rule', trigger: { kind: 'task_created' }, conditions: {} };
    expect(automationInputSchema.safeParse({ ...base, actions: [] }).success).toBe(false);
    expect(
      automationInputSchema.safeParse({ ...base, actions: [emptyAction('add_label')] }).success,
    ).toBe(false);
    expect(
      automationInputSchema.safeParse({
        ...base,
        actions: Array.from({ length: 4 }, () => ({ kind: 'unassign' })),
      }).success,
    ).toBe(false);
    expect(
      automationInputSchema.safeParse({ ...base, actions: [emptyAction('set_due_date')] }).success,
    ).toBe(true);
  });
});
