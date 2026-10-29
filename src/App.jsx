
<div className="between">
  <select
    aria-label="Filter by category"
    value={categoryFilter}
    onChange={e => setCategoryFilter(e.target.value)}
  >
    <option value="All">Filter by category</option>
    {["Fruits", "Vegetables", "Dairy", "Bakery", "Meat", "Other"].map(c =>
      <option key={c} value={c}>{c}</option>
    )}
  </select>

  <select
    aria-label="Filter by status"
    value={statusFilter}
    onChange={e => setStatusFilter(e.target.value)}
  >
    <option value="All">Filter by status</option>
    <option value="Fresh">Fresh</option>
    <option value="Expiring Soon">Expiring Soon</option>
    <option value="Expired">Expired</option>
  </select>
</div>
export default App;