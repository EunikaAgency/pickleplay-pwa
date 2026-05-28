import { getUsers } from '../../shared/data/index.js';

export default function AdminUsersPage() {
  const users = getUsers();
  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="font-heading text-headline-lg font-bold text-on-surface">Manage Users</h1><p className="mt-1 text-body-md text-on-surface-variant">{users.length} users</p></div>
      </div>
      <div className="mt-6 rounded-[14px] bg-surface-container-lowest shadow-card overflow-hidden">
        <table className="w-full text-body-md">
          <thead className="border-b border-surface-variant text-left">
            <tr><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">User</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Role</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Skill</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Games</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-container-low">
                <td className="p-4 flex items-center gap-3"><img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /><span className="font-semibold text-on-surface">{u.firstName} {u.lastName}</span></td>
                <td className="p-4"><span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-primary-fixed">{u.role}</span></td>
                <td className="p-4 text-on-surface-variant">{u.skillLabel}</td>
                <td className="p-4">{u.gamesPlayed}</td>
                <td className="p-4"><button className="font-semibold text-primary hover:underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
