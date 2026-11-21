'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Save, Folder } from 'lucide-react';

type Category = { _id: string; name: string };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [form, setForm] = useState({ name: '' });
  const [editForm, setEditForm] = useState({ _id: '', name: '' });

  useEffect(() => {
    fetch('/api/inventory/categories')
      .then((r) => r.json())
      .then((data) => { setCategories(data); setLoading(false); });
  }, []);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/inventory/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name }),
    });
    if (res.ok) {
      const cat = await res.json();
      setCategories([cat, ...categories]);
      setOpen(false);
      setForm({ name: '' });
    }
  };

  const updateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/inventory/categories/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editForm.name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCategories(categories.map((c) => (c._id === updated._id ? updated : c)));
      setEditOpen(false);
      setEditingId('');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await fetch(`/api/inventory/categories/${id}`, { method: 'DELETE' });
    setCategories(categories.filter((c) => c._id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Folder size={18} /> Add Category
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : categories.length === 0 ? (
        <p className="text-gray-500">No categories yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Category Name</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c._id}>
                <td>{i + 1}</td>
                <td>{c.name}</td>
                <td className="text-right">
                  <button
                    className="text-Inpay-600 hover:text-Inpay-700 mr-2"
                    title="Edit"
                    onClick={() => { setEditingId(c._id); setEditForm({ _id: c._id, name: c.name }); setEditOpen(true); }}
                  >
                    <Edit3 size={16} />
                  </button>{' '}
                  <button
                    className="text-red-600 hover:text-red-700"
                    title="Delete"
                    onClick={() => deleteCategory(c._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">Add Category</h2>
          <form onSubmit={addCategory} className="space-y-3">
            <div>
              <label className="label">Category Name</label>
              <input
                className="input"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Save Category
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={`fixed inset-0 z-50 flex items-center justify-center ${editOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setEditOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">Edit Category</h2>
          <form onSubmit={updateCategory} className="space-y-3">
            <input type="hidden" name="_id" value={editingId} />
            <div>
              <label className="label">Category Name</label>
              <input
                className="input"
                name="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Update Category
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
