// Bottom sheets shared by several screens: reschedule, slot edit, rename, talent menu.

import { el } from '../dom.js';
import { text, raw } from '../text.js';
import { dayLabel, hm, localStamp } from '../time.js';
import {
  state, saveSlot, deleteSlot, saveTalent, deleteTalent,
} from '../store.js';
import { rescheduleOptions, rescheduleTarget, resolveCollision } from '../model/schedule.js';
import {
  openSheet, closeSheet, segmented, timePicker, field, textInput,
} from './widgets.js';
import { lengthOptions, placeOptions, weekdayOptions } from './addTalent.js';

/** Reschedule one instance (spec 6.8). onMoved(message) gets the S09 line. */
export function rescheduleSheet(inst, onMoved) {
  const now = new Date();
  const labels = raw('L54');
  const index = { inHour: 0, tonight: 1, tomorrow: 2 };
  const buttons = rescheduleOptions(now).map((opt) => el('button', {
    type: 'button',
    class: 'btn',
    onclick: async () => {
      const target = resolveCollision(rescheduleTarget(opt, inst, now), inst, state);
      const slot = { ...inst.slot, overrides: { ...(inst.slot.overrides || {}), [inst.key]: localStamp(target) } };
      await saveSlot(slot);
      closeSheet();
      onMoved(text('S09', { day: dayLabel(target, new Date()), time: hm(target) }));
    },
  }, labels[index[opt]]));
  openSheet(el('div', { class: 'stack' }, ...buttons,
    el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03'))));
}

/** Edit a slot permanently: day, anchor, time, length, place; or delete it. */
export function slotEditSheet(slot, onSaved, { allowDelete = true } = {}) {
  const L62 = raw('L62');
  const day = segmented(weekdayOptions(), slot.weekday);
  const anchor = textInput(slot.anchor || '', { maxlength: 40 });
  const time = timePicker(slot.time);
  const length = segmented(lengthOptions(), slot.length);
  const placeText = textInput(slot.placeText || '', { maxlength: 40, hidden: slot.place !== 'custom' });
  const place = segmented(placeOptions(), slot.place, (v) => { placeText.hidden = v !== 'custom'; });

  const save = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    onclick: async () => {
      await saveSlot({
        ...slot,
        weekday: day.value,
        anchor: anchor.value.trim(),
        time: time.value,
        length: length.value,
        place: place.value,
        placeText: place.value === 'custom' ? placeText.value.trim() : '',
      });
      closeSheet();
      onSaved();
    },
  }, raw('L21'));

  const del = allowDelete ? confirmDeleteButton(async () => {
    await deleteSlot(slot.id);
    closeSheet();
    onSaved();
  }) : null;

  openSheet(el('div', { class: 'stack' },
    field(L62[0], day.node),
    field(L62[1], anchor),
    field(L62[2], time.node),
    field(L62[3], length.node),
    field(L62[4], place.node, placeText),
    save,
    del,
    el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03'))));
}

/** "Delete" that turns into "Tap again to delete" (L16 / L17). */
export function confirmDeleteButton(onConfirm) {
  let armed = false;
  const b = el('button', { type: 'button', class: 'btn' }, raw('L16'));
  b.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      b.textContent = raw('L17');
      return;
    }
    b.disabled = true;
    onConfirm();
  });
  return b;
}

export function renameSheet(talent, onSaved) {
  const input = textInput(talent.name, { maxlength: 60 });
  openSheet(el('div', { class: 'stack' },
    field(raw('L61')[0], input),
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: async () => {
        const name = input.value.trim();
        if (!name) return;
        await saveTalent({ ...talent, name });
        closeSheet();
        onSaved();
      },
    }, raw('L21')),
    el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03'))));
  input.focus();
}

/** Long-press menu on a talent row (role changes come in stage 3). */
export function talentMenu(talent, onChanged) {
  openSheet(el('div', { class: 'stack' },
    el('p', { class: 'muted' }, talent.name),
    el('button', { type: 'button', class: 'btn', onclick: () => renameSheet(talent, onChanged) }, raw('L18')),
    confirmDeleteButton(async () => {
      await deleteTalent(talent.id);
      closeSheet();
      onChanged();
    }),
    el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03'))));
}
