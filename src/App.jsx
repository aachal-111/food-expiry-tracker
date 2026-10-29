
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

const emptyFood = {
  name: "",
  category: "",
  quantity: "",
  purchase_date: "",
  expiry_date: "",
};

function getStatus(date) {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiry = new Date(date + "T00:00:00");
  const days = Math.round((expiry - current) / 86400000);

  if (days < 0) return "Expired";
  if (days <= 3) return "Expiring Soon";
  return "Fresh";
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState("login");
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [foods, setFoods] = useState([]);
  const [food, setFood] = useState(emptyFood);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setFoods([]);
      setPage("login");
      return;
    }

    setPage("dashboard");

    async function loadFoods() {
      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) setMessage(error.message);
      else setFoods(data || []);
    }

    loadFoods();
  }, [session?.user?.id]);

  async function handleAuth(e) {
    e.preventDefault();
    setMessage("");
    setBusy(true);

    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
    } else if (register && !result.data.session) {
      setMessage("Account created. Check your email to confirm registration, then log in.");
    } else {
      setMessage("");
    }
  }

  async function saveFood(e) {
    e.preventDefault();
    if (!session?.user) return;

    setBusy(true);
    setMessage("");

    const payload = {
      name: food.name.trim(),
      category: food.category,
      quantity: Number(food.quantity),
      purchase_date: food.purchase_date,
      expiry_date: food.expiry_date,
      user_id: session.user.id,
    };

    const query = editingId
      ? supabase.from("food_items")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", session.user.id)
      : supabase.from("food_items").insert(payload);

    const { error } = await query;
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setFood(emptyFood);
    setEditingId(null);
    await refreshFoods();
    setPage("list");
  }

  async function refreshFoods() {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("food_items")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setFoods(data || []);
  }

  async function deleteFood(id) {
    if (!window.confirm("Delete this food item?")) return;

    const { error } = await supabase
      .from("food_items")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) setMessage(error.message);
    else await refreshFoods();
  }

  function editFood(item) {
    setFood({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      purchase_date: item.purchase_date,
      expiry_date: item.expiry_date,
    });
    setEditingId(item.id);
    setMessage("");
    setPage("add");
  }

  function openAdd() {
    setFood(emptyFood);
    setEditingId(null);
    setMessage("");
    setPage("add");
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  const fresh = foods.filter(f => getStatus(f.expiry_date) === "Fresh").length;
  const expiring = foods.filter(f => getStatus(f.expiry_date) === "Expiring Soon").length;
  const expired = foods.filter(f => getStatus(f.expiry_date) === "Expired").length;

  const filteredFoods = foods.filter(f => {
    return (
      f.name.toLowerCase().includes(search.toLowerCase()) &&
      (categoryFilter === "All" || f.category === categoryFilter) &&
      (statusFilter === "All" || getStatus(f.expiry_date) === statusFilter)
    );
  });

  if (loading) return <div className="phone">Loading...</div>;

  return (
    <div className="phone">
      <header>
        <span>🌿 Food Expiry Tracker</span>
        {session && (
          <button className="menu" onClick={logout}>Logout</button>
        )}
      </header>

      {message && <p role="alert" style={{ color: "#ffb4a8", fontSize: 12 }}>{message}</p>}

      {!session && (
        <section>
          <h3>Login Register</h3>
          <div className="welcome">
            <strong>{register ? "Create Account" : "Welcome Back"}</strong>
            <p>{register ? "Register your account" : "Login to your account"}</p>
          </div>

          <form onSubmit={handleAuth}>
            <input type="email" placeholder="✉ Email" required
              value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="🔒 Password" required
              minLength={6} value={password}
              onChange={e => setPassword(e.target.value)} />
            <button className="green" disabled={busy}>
              {busy ? "Please wait..." : register ? "Register" : "Login"}
            </button>
          </form>

          <button className="outline" onClick={() => {
            setRegister(!register);
            setMessage("");
          }}>
            {register ? "Already have an account? Login" : "Don't have an account? Register"}
          </button>
        </section>
      )}

      {session && page === "dashboard" && (
        <section>
          <div className="welcome">
            <strong>Hello, Aachal!</strong>
            <p>Here is your food summary.</p>
          </div>

          <div className="stats">
            <div className="stat green-card"><b>{foods.length}</b><span>Total Food Items</span></div>
            <div className="stat green-card"><b>{fresh}</b><span>Fresh Items</span></div>
            <div className="stat yellow-card"><b>{expiring}</b><span>Expiring Soon</span></div>
            <div className="stat red-card"><b>{expired}</b><span>Expired Items</span></div>
          </div>

          <button className="green" onClick={openAdd}>+ Add Food</button>

          <div className="between">
            <strong>Recent Items</strong>
            <button onClick={() => setPage("list")}>View all</button>
          </div>

          {foods.length === 0 && <p>No food items yet. Add your first food!</p>}

          {foods.slice(0, 3).map(f => (
            <div className="recent" key={f.id}>
              <span>{f.name}<small>{f.category}</small></span>
              <b className="status">{getStatus(f.expiry_date)}</b>
            </div>
          ))}
        </section>
      )}

      {session && page === "add" && (
        <section>
          <h3>{editingId ? "Edit Food Item" : "← Add Food Item"}</h3>

          <form onSubmit={saveFood}>
            <label>Food Name</label>
            <input required placeholder="Enter food name" value={food.name}
              onChange={e => setFood({ ...food, name: e.target.value })} />

            <label>Category</label>
            <select required value={food.category}
              onChange={e => setFood({ ...food, category: e.target.value })}>
              <option value="">Select category</option>
              {["Fruits", "Vegetables", "Dairy", "Bakery", "Meat", "Other"].map(c =>
                <option key={c}>{c}</option>
              )}
            </select>

            <label>Quantity</label>
            <input type="number" min="1" required value={food.quantity}
              onChange={e => setFood({ ...food, quantity: e.target.value })} />

            <label>Purchase Date</label>
            <input type="date" required value={food.purchase_date}
              onChange={e => setFood({ ...food, purchase_date: e.target.value })} />

            <label>Expiry Date</label>
            <input type="date" required value={food.expiry_date}
              onChange={e => setFood({ ...food, expiry_date: e.target.value })} />

            <button className="green" disabled={busy}>
              {busy ? "Saving..." : editingId ? "Update Food" : "Save"}
            </button>
          </form>

          <button className="outline" onClick={() => setPage("dashboard")}>
            Back to Dashboard
          </button>
        </section>
      )}

      {session && page === "list" && (
        <section>
          <h3>Food Items + Add Food</h3>

          <input placeholder="🔍 Search food items..." value={search}
            onChange={e => setSearch(e.target.value)} />

          <div className="between">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option>All</option>
              {["Fruits", "Vegetables", "Dairy", "Bakery", "Meat", "Other"].map(c =>
                <option key={c}>{c}</option>
              )}
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option>All</option>
              <option>Fresh</option>
              <option>Expiring Soon</option>
              <option>Expired</option>
            </select>
          </div>

          <button className="green" onClick={openAdd}>+ Add Food</button>

          {filteredFoods.length === 0 && <p>No matching food items found.</p>}

          {filteredFoods.map(f => (
            <div className="food-card" key={f.id}>
              <strong>{f.name} — {getStatus(f.expiry_date)}</strong>
              <p>Category: {f.category}</p>
              <p>Quantity: {f.quantity}</p>
              <p>Purchase: {f.purchase_date}</p>
              <p>Expiry: {f.expiry_date}</p>
              <button onClick={() => editFood(f)}>Edit</button>{" "}
              <button onClick={() => deleteFood(f.id)}>Delete</button>
            </div>
          ))}

          <button className="outline" onClick={() => setPage("dashboard")}>
            Back to Dashboard
          </button>
        </section>
      )}
    </div>
  );
}

export default App;
