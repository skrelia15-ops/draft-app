// lib/groups/mappers.test.ts
import {
  rowToGroup,
  rowToGroupRide,
  type GroupRow,
  type GroupRideRow,
} from './mappers';

describe('rowToGroup', () => {
  const ROW: GroupRow = {
    id: 'g1',
    name: 'DAWN PATROL',
    description: null,
    pace_kmh: 32,
    train_type: 'ROTATING',
    owner_id: 'u1',
    is_official: false,
    member_count: 22,
    created_at: '2026-06-09T00:00:00Z',
  };

  it('maps columns and carries the member flag from the caller', () => {
    expect(rowToGroup(ROW, true)).toEqual({
      id: 'g1',
      name: 'DAWN PATROL',
      description: null,
      paceKmh: 32,
      trainType: 'ROTATING',
      ownerId: 'u1',
      memberCount: 22,
      isMember: true,
      createdAt: Date.parse('2026-06-09T00:00:00Z'),
    });
  });

  it('defaults member_count to 0 when the view returns null', () => {
    expect(rowToGroup({ ...ROW, member_count: null }, false).memberCount).toBe(0);
  });

  it('maps a null owner_id (official groups) to an empty string', () => {
    expect(rowToGroup({ ...ROW, owner_id: null }, false).ownerId).toBe('');
  });
});

describe('rowToGroupRide', () => {
  it('maps columns and flattens the joined group name', () => {
    const row: GroupRideRow = {
      id: 'r1',
      group_id: 'g1',
      title: 'Sunday spin',
      scheduled_at: '2026-06-14T07:00:00Z',
      route_id: 'coastal',
      created_by: 'u1',
      created_at: '2026-06-09T00:00:00Z',
      groups: { name: 'DAWN PATROL' },
    };
    expect(rowToGroupRide(row)).toEqual({
      id: 'r1',
      groupId: 'g1',
      groupName: 'DAWN PATROL',
      title: 'Sunday spin',
      scheduledAt: Date.parse('2026-06-14T07:00:00Z'),
      routeId: 'coastal',
      createdBy: 'u1',
      createdAt: Date.parse('2026-06-09T00:00:00Z'),
    });
    expect(rowToGroupRide({ ...row, groups: null }).groupName).toBe('');
  });
});
