import { eventConflictState, indexConflicts } from './conflictIndex';

const active = { eventAId: 'a', eventBId: 'b', overlapStart: 's', overlapEnd: 'e' };
const ignored = { eventAId: 'b', eventBId: 'c', overlapStart: 's', overlapEnd: 'e', mode: 'allow' as const, ignoreId: 'i1' };

test('lists each conflict under both of its events', () => {
  const idx = indexConflicts({ active: [active], ignored: [ignored] });
  expect(idx.get('a')).toEqual([{ eventAId: 'a', eventBId: 'b', otherId: 'b', state: 'active' }]);
  expect(idx.get('c')).toEqual([{ eventAId: 'b', eventBId: 'c', otherId: 'b', state: 'ignored', mode: 'allow', ignoreId: 'i1' }]);
  expect(idx.get('b')).toHaveLength(2);
});

test('an active conflict wins over an ignored one; none gives null', () => {
  const idx = indexConflicts({ active: [active], ignored: [ignored] });
  expect(eventConflictState(idx.get('b'))).toBe('active');
  expect(eventConflictState(idx.get('c'))).toBe('ignored');
  expect(eventConflictState(idx.get('zzz'))).toBeNull();
});
