import { expect, test } from './fixtures';
import { z } from 'zod';
import { isoDay, mod, restAs, signUpWithWorkspace } from './helpers';

const short = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });
const label = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return short.format(date);
};
const created = z.array(z.object({ id: z.string() }));

test('move, resize and link tasks on the timeline', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  const rest = await restAs(page);
  const [team] = z
    .array(z.object({ id: z.string(), workspace_id: z.string() }))
    .parse(await rest.get('teams?key=eq.ENG&select=id,workspace_id'));
  const base = { team_id: team?.id, workspace_id: team?.workspace_id };
  const [design] = created.parse(
    await (
      await rest.post('tasks?select=id', {
        ...base,
        title: 'Design',
        start_date: isoDay(0),
        due_date: isoDay(2),
      })
    ).json(),
  );
  const [build] = created.parse(
    await (
      await rest.post('tasks?select=id', {
        ...base,
        title: 'Build',
        start_date: isoDay(1),
        due_date: isoDay(4),
      })
    ).json(),
  );
  await rest.post('task_relations', {
    workspace_id: team?.workspace_id,
    task_id: design?.id,
    related_task_id: build?.id,
    kind: 'blocks',
  });

  await page.goto(`/${slug}/team/ENG/tasks?layout=timeline`);
  const designBar = page.getByRole('button', { name: /^ENG-\d+ Design,/ });
  await expect(designBar).toHaveAccessibleName(new RegExp(`${label(0)} to ${label(2)}$`));

  // Build starts before Design ends: the dependency arrow shows the conflict.
  const arrow = page.locator('svg path[marker-end]');
  await expect(arrow).toHaveCount(1);
  await expect(arrow).toHaveClass(/stroke-danger/);

  // Keyboard: move the bar a day, then push its due date a day.
  await designBar.focus();
  await page.keyboard.press(`${mod}+ArrowRight`);
  await expect(designBar).toHaveAccessibleName(new RegExp(`${label(1)} to ${label(3)}$`));
  await page.keyboard.press(`${mod}+Shift+ArrowRight`);
  await expect(designBar).toHaveAccessibleName(new RegExp(`${label(1)} to ${label(4)}$`));

  // Pointer: drag Build four days later; it now starts after Design ends.
  const buildBar = page.getByRole('button', { name: /^ENG-\d+ Build,/ });
  const box = await buildBar.boundingBox();
  if (!box) throw new Error('Build bar is not on screen');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 4 * 32, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(buildBar).toHaveAccessibleName(new RegExp(`${label(5)} to ${label(8)}$`));
  await expect(arrow).not.toHaveClass(/stroke-danger/);

  await page.reload();
  await expect(designBar).toHaveAccessibleName(new RegExp(`${label(1)} to ${label(4)}$`));
  await expect(buildBar).toHaveAccessibleName(new RegExp(`${label(5)} to ${label(8)}$`));
});
